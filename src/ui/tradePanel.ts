import {
  cargoUsed,
  saveCommanderLedger,
  type CommanderLedger,
  type MarketItem,
} from "../game/economy.ts";

export interface TradePanel {
  toggle(): void;
  setOpen(open: boolean): void;
  dispose(): void;
}

function credits(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} Cr`;
}

function appendText<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  text: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  parent.appendChild(el);
  return el;
}

export function createTradePanel(
  host: HTMLElement,
  market: MarketItem[],
  ledger: CommanderLedger,
): TradePanel {
  const root = document.createElement("section");
  root.id = "trade-panel";
  root.hidden = true;

  const header = document.createElement("header");
  appendText(header, "h2", "Station Market");
  const close = document.createElement("button");
  close.type = "button";
  close.dataset.action = "close";
  close.textContent = "Close";
  header.appendChild(close);
  root.appendChild(header);

  const summary = document.createElement("div");
  summary.className = "trade-summary";
  const creditsEl = appendText(summary, "strong", "");
  const cargoEl = appendText(summary, "strong", "");
  root.appendChild(summary);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headingRow = document.createElement("tr");
  ["Good", "Price", "Stock", "Hold", ""].forEach((label) => appendText(headingRow, "th", label));
  thead.appendChild(headingRow);
  const tbody = document.createElement("tbody");
  table.append(thead, tbody);
  root.appendChild(table);

  function render(): void {
    creditsEl.textContent = credits(ledger.credits);
    cargoEl.textContent = `${cargoUsed(ledger)}/${ledger.cargoCapacity} TC`;
    tbody.replaceChildren();

    market.forEach((item) => {
      const held = ledger.cargo[item.commodity.id] ?? 0;
      const row = document.createElement("tr");
      appendText(row, "td", item.commodity.name);
      appendText(row, "td", credits(item.price));
      appendText(row, "td", String(item.stock));
      appendText(row, "td", String(held));

      const actions = document.createElement("td");
      const buy = document.createElement("button");
      buy.type = "button";
      buy.dataset.action = "buy";
      buy.dataset.id = item.commodity.id;
      buy.textContent = "Buy";
      buy.disabled = item.stock <= 0 || ledger.credits < item.price || cargoUsed(ledger) >= ledger.cargoCapacity;

      const sell = document.createElement("button");
      sell.type = "button";
      sell.dataset.action = "sell";
      sell.dataset.id = item.commodity.id;
      sell.textContent = "Sell";
      sell.disabled = held <= 0;

      actions.append(buy, sell);
      row.appendChild(actions);
      tbody.appendChild(row);
    });
  }

  function buy(item: MarketItem): void {
    if (item.stock <= 0 || ledger.credits < item.price || cargoUsed(ledger) >= ledger.cargoCapacity) return;
    item.stock -= 1;
    ledger.credits -= item.price;
    ledger.cargo[item.commodity.id] = (ledger.cargo[item.commodity.id] ?? 0) + 1;
    saveCommanderLedger(ledger);
    render();
  }

  function sell(item: MarketItem): void {
    const held = ledger.cargo[item.commodity.id] ?? 0;
    if (held <= 0) return;
    item.stock += 1;
    ledger.credits += Math.round(item.price * 0.92);
    ledger.cargo[item.commodity.id] = held - 1;
    if (ledger.cargo[item.commodity.id] <= 0) delete ledger.cargo[item.commodity.id];
    saveCommanderLedger(ledger);
    render();
  }

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const action = target.dataset.action;
    if (action === "close") {
      root.hidden = true;
      return;
    }

    const item = market.find((candidate) => candidate.commodity.id === target.dataset.id);
    if (!item) return;
    if (action === "buy") buy(item);
    if (action === "sell") sell(item);
  });

  host.appendChild(root);
  render();

  return {
    toggle(): void {
      root.hidden = !root.hidden;
    },
    setOpen(open: boolean): void {
      root.hidden = !open;
    },
    dispose(): void {
      root.remove();
    },
  };
}
