import React, { useState, useEffect, useRef } from "react";
import { Form, Input, Button, Typography } from "antd";
import ReactGA from "react-ga";
import { useTranslation } from 'react-i18next';

import { validator } from "utils/validators";
import { generateLink } from "utils/generateLink";
import { $get_exchange_result } from "helpers/bonded";
import config from "config";

const { useForm } = Form;
const { Text } = Typography;

export const RedeemToken = ({
  address,
  activeWallet,
  stable_state,
  reserve_asset_symbol,
  reservePrice,
  symbol,
  type,
  actualParams,
  p2,
  oraclePrice,
  supply
}) => {
  const asset = stable_state && stable_state["asset" + type];
  const decimals = actualParams && actualParams["decimals" + type];
  const reserve_asset_decimals =
    actualParams && actualParams.reserve_asset_decimals;
  const reserve_asset = actualParams && actualParams.reserve_asset;
  const [valid, setValid] = useState(undefined);
  const [exchange, setExchange] = useState(undefined);
  const buttonRef = useRef(null);
  const [tokens, setTokens] = useState(undefined);
  const [form] = useForm();
  const { t } = useTranslation();
  const { getFieldsValue, resetFields } = form;

  const validateValue = (params) => {
    return validator({
      ...params,
      onSuccess: () => setValid(true),
      onError: () => setValid(false),
    });
  };

  useEffect(() => {
    resetFields();
    setValid(undefined);
  }, [address, resetFields]);

  useEffect(() => {
    const get_exchange_result =
      actualParams &&
      $get_exchange_result({
        tokens1: type === 1 ? -(tokens * 10 ** decimals) : 0,
        tokens2: type === 2 ? -(tokens * 10 ** decimals) : 0,
        params: actualParams,
        vars: stable_state,
        oracle_price: oraclePrice,
        timestamp: Math.floor(Date.now() / 1000),
        reservePrice,
      });

    setExchange(get_exchange_result);
  }, [getFieldsValue, tokens, activeWallet, address, asset, decimals, valid, stable_state]);

  const link = generateLink(
    Math.trunc(Number(tokens).toFixed(decimals) * 10 ** decimals),
    {},
    activeWallet,
    address,
    asset
  );

  let extra;
  if (
    exchange !== undefined &&
    exchange !== null &&
    valid &&
    tokens !== "" &&
    exchange.payout > 0
  ) {
    extra = t("trade.tabs.buy_redeem.redeem_will_receive",  "You will get {{amount}} {{symbol}}", {amount: (exchange.payout / 10 ** reserve_asset_decimals).toFixed(reserve_asset_decimals), symbol: config.reserves[reserve_asset] ? config.reserves[reserve_asset].name : reserve_asset_symbol || ''});
  } else if (exchange && exchange.payout < 0) {
    extra = t("trade.tabs.buy_redeem.big_change", "The transaction would change the price too much, please try a smaller amount");
  } else {
    extra = undefined;
  }

  let bPriceInversed = false;
  if ("oracles" in actualParams) {
    if (actualParams.oracles[0].op === "*" && !actualParams.leverage)
      bPriceInversed = true;
  } else {
    if (actualParams.op1 === "*" && !actualParams.leverage)
      bPriceInversed = true;
  }

  const new_p2 = exchange ? (bPriceInversed ? 1 / exchange.p2 : exchange.p2) : undefined;
  const old_p2 = bPriceInversed ? 1 / p2 : p2;
  const t_p2 = exchange ? (bPriceInversed ? 1 / exchange.target_p2 : exchange.target_p2) : undefined;

  const priceChange =
    exchange && "p2" in exchange ? new_p2 - old_p2 : 0;

  const priceChangePercent =
    exchange && "p2" in exchange
      ? ((new_p2 - old_p2) / old_p2) * 100
      : 0;
  const changeFinalPricePercent =
    exchange && "p2" in exchange
      ? ((new_p2 - t_p2) /
        t_p2) *
      100
      : 0;

  return (
    <Form
      form={form}
      onValuesChange={(store) => {
        setTokens(store["r_tokens" + type]);
      }}
      size="large"
    >
      <Form.Item
        name={`r_tokens${type}`}
        extra={extra}
        rules={[
          {
            validator: (rule, value) =>
              validateValue({
                value,
                name: "r_tokens",
                type: "number",
                minValue: Number(1 / 10 ** decimals).toFixed(decimals),
                maxDecimals: decimals,
                maxValue: supply
              }),
          },
        ]}
      >
        <Input.Search
          placeholder={t(`trade.tabs.buy_redeem.amount${type}_placeholder`, `Amount of tokens${type} ({{symbolOrAsset}} — ${type === 1 ? "growth" : "interest"} tokens)`, {symbolOrAsset: symbol || asset})}
          autoComplete="off"
          style={{ marginBottom: 0 }}
          onKeyPress={(ev) => {
            if (ev.key === "Enter") {
              if (valid && exchange !== null) {
                buttonRef.current.click();
              }
            }
          }}
          onSearch={() => {
            ReactGA.event({
              category: "Stablecoin",
              action: "Redeem token" + type,
            });
          }}
          enterButton={
            <Button
              type="primary"
              ref={buttonRef}
              disabled={
                !valid || exchange === null || (exchange && exchange.payout < 0) || tokens > supply
              }
              href={link}
            >
              {t("trade.tabs.buy_redeem.redeem", "Redeem")}
            </Button>
          }
        />
      </Form.Item>
      {exchange !== undefined &&
        exchange !== null &&
        valid &&
        tokens !== "" &&
        priceChange &&
        exchange.payout > 0 ? (
          <div style={{ marginBottom: 20 }}>
            <Text type="secondary" style={{ display: "block" }}>
              <b>{t("trade.tabs.buy_redeem.fee", "Fee")}: </b>
              {"fee_percent" in exchange
                ? exchange.fee_percent.toFixed(4) + "%"
                : "0%"}
            </Text>
            <Text type="secondary" style={{ display: "block" }}>
              <b>{t("trade.tabs.buy_redeem.reward", "Reward")}: </b>
              {"reward_percent" in exchange
                ? exchange.reward_percent.toFixed(4) + "%"
                : "0%"}
            </Text>
            {exchange && "p2" in exchange && (
              <Text type="secondary" style={{ display: "block" }}>
                <b>{t("trade.tabs.buy_redeem.price_change", "Price change")}: </b>
                {priceChange > 0 ? "+" : ""}
                {priceChange.toFixed(reserve_asset_decimals) || "0"} (
                {priceChangePercent > 0 ? "+" : ""}
                {priceChangePercent.toFixed(2)}%)
              </Text>
            )}

            <Text type="secondary" style={{ display: "block" }}>
              <b>{t("trade.tabs.buy_redeem.final_price", "Final price")}: </b>
              {new_p2.toFixed(reserve_asset_decimals) || "0"} (
            {Math.abs(changeFinalPricePercent).toFixed(2)}%{" "}
              {changeFinalPricePercent > 0 ? t("trade.tabs.buy_redeem.above_target", "above the target") : t("trade.tabs.buy_redeem.below_target", "below the target")})
          </Text>
          </div>
        ) : (
          <div />
        )}
    </Form>
  );
};
