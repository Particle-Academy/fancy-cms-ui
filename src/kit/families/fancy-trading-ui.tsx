/** fancy-trading-ui components as kit islands. */
import { OrderBook, DepthChart, TimeAndSales, WatchList, PriceLadder, PositionsTable, OrdersTable, FillsTable, Blotter, Alerts, ModeMarker, Withheld } from "@particle-academy/fancy-trading-ui";
import "@particle-academy/fancy-trading-ui/styles.css";
import type { IslandComponent } from "../../react/islands";
import { generic } from "../generic";

export const islands: Record<string, IslandComponent> = {
  "fancy-trading-ui:OrderBook": generic(OrderBook),
  "fancy-trading-ui:DepthChart": generic(DepthChart),
  "fancy-trading-ui:TimeAndSales": generic(TimeAndSales),
  "fancy-trading-ui:WatchList": generic(WatchList),
  "fancy-trading-ui:PriceLadder": generic(PriceLadder),
  "fancy-trading-ui:PositionsTable": generic(PositionsTable),
  "fancy-trading-ui:OrdersTable": generic(OrdersTable),
  "fancy-trading-ui:FillsTable": generic(FillsTable),
  "fancy-trading-ui:Blotter": generic(Blotter),
  "fancy-trading-ui:Alerts": generic(Alerts),
  "fancy-trading-ui:ModeMarker": generic(ModeMarker),
  "fancy-trading-ui:Withheld": generic(Withheld),
};
