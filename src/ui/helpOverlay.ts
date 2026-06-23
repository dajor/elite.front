export interface HelpOverlay {
  toggle(): void;
  setOpen(open: boolean): void;
}

interface HelpSection {
  title: string;
  items: Array<[keys: string, action: string]>;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Flug",
    items: [
      ["W/S oder Pfeile hoch/runter", "Nickachse"],
      ["A/D oder Pfeile links/rechts", "Gierachse"],
      ["Q/E", "Rollen"],
      ["Shift/Ctrl", "Schub stufenlos"],
      ["+/-", "Schub in Stufen"],
      ["Backspace", "Retro-Bremse"],
      ["1/2/3/4", "Ansicht wechseln"],
    ],
  },
  {
    title: "Kampf",
    items: [
      ["Space", "Laser feuern"],
      ["R", "Ziel wechseln"],
      ["M", "Rakete starten"],
    ],
  },
  {
    title: "Station",
    items: [
      ["T", "Markt umschalten"],
      ["C", "Docking-Computer / Start"],
      ["Esc", "Panel schliessen"],
    ],
  },
  {
    title: "Navigation",
    items: [
      ["B", "Autopilot Station"],
      ["Z/X", "Zeit langsamer/schneller"],
      ["J", "Hypersprung"],
      ["H oder ?", "Tastenhilfe"],
    ],
  },
];

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

function appendKeyRow(parent: HTMLElement, keys: string, action: string): void {
  const row = document.createElement("div");
  row.className = "help-row";
  appendText(row, "kbd", keys);
  appendText(row, "span", action);
  parent.appendChild(row);
}

export function createHelpOverlay(host: HTMLElement, onClose?: () => void): HelpOverlay {
  const toggleButton = document.createElement("button");
  toggleButton.id = "help-toggle";
  toggleButton.type = "button";
  toggleButton.title = "Tastenhilfe";
  toggleButton.setAttribute("aria-controls", "help-panel");
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.textContent = "?";

  const root = document.createElement("section");
  root.id = "help-panel";
  root.hidden = true;
  root.setAttribute("aria-modal", "true");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-labelledby", "help-title");

  const panel = document.createElement("article");
  const header = document.createElement("header");
  appendText(header, "h2", "Tastenhilfe", "help-title").id = "help-title";
  const close = document.createElement("button");
  close.type = "button";
  close.dataset.action = "close";
  close.title = "Schliessen";
  close.textContent = "X";
  header.appendChild(close);
  panel.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "help-grid";
  HELP_SECTIONS.forEach((section) => {
    const group = document.createElement("section");
    appendText(group, "h3", section.title);
    section.items.forEach(([keys, action]) => appendKeyRow(group, keys, action));
    grid.appendChild(group);
  });
  panel.appendChild(grid);
  root.appendChild(panel);

  function isOpen(): boolean {
    return !root.hidden;
  }

  function setOpen(open: boolean): void {
    root.hidden = !open;
    toggleButton.setAttribute("aria-expanded", String(open));
    if (open) {
      close.focus();
      return;
    }
    onClose?.();
  }

  toggleButton.addEventListener("click", () => setOpen(!isOpen()));
  close.addEventListener("click", () => setOpen(false));
  root.addEventListener("click", (event) => {
    if (event.target === root) setOpen(false);
  });

  host.append(toggleButton, root);

  return {
    toggle(): void {
      setOpen(!isOpen());
    },
    setOpen,
  };
}
