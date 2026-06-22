# Elite — Browser-Remake (Design)

**Datum:** 2026-06-22
**Status:** Entwurf, validiert
**Vorlage:** [Elite (Computerspiel)](https://de.wikipedia.org/wiki/Elite_(Computerspiel)) — Ian Bell & David Braben, 1984

## Ziel

Elite als Browserspiel nachgebaut. Gleiches Game-Character (Game-Loop, Wirtschaft, Factions, Schiffe, Combat, Docking, Hypersprung, 8 Galaxien / 2048 Systeme, Ränge bis „Elite", Missionen, Thargoiden, Trumbles). Moderne Grafik (Neon-Vektor). Multiplayer: mehrere Spieler gleichzeitig im selben Universum.

## Entscheidungen

| Bereich | Wahl | Begründung |
|---|---|---|
| Grafik | Neon-Vektor (Modern Retro) | Original-Ästhetik + Bloom/Scanline, billig zu rendern |
| Multiplayer | P2P + Host-Autorität | Kein dauerhafter Game-Server nötig |
| Frontend | Babylon.js (TypeScript, Vite) | Engine + Physics + Scene-Graph, weniger Boilerplate |
| Scope | Voll-Feature-Parität | 8 Galaxien, alle Factions, Missionen, Thargoiden, Trumbles |
| Persistenz | (b) Host-Migration + Snapshot-Transfer | P2P bleiben, Save-Loss mildern |

## Architektur-Übersicht

### Client (Babylon.js, TypeScript, Vite)
- Render: WebGL2, Wireframe/Low-Poly-Meshes mit Emissive-Edges, Bloom-PostFX, Scanline-Shader.
- Scene-Graph pro Raumsystem: Sterne, Planet, rotierende Orbitalstation, Schiffe, Projektile.
- Game-Loop: `requestAnimationFrame` (60 Hz Render) + festes Simulations-Interval (20 Hz Tick), getrennt.
- Input: Tastatur (Original-Belegung — `Space`=Fire, Views `1`–`4`, `J`=Jump), Maus als Joystick-Emulation, Gamepad-API optional.

### Multiplayer-Schicht (WebRTC DataChannels)
- Signaling: leichter Signaling-Server (PeerJS-Cloud oder Cloudflare Worker + Durable Object) — nur SDP/ICE-Austausch, kein Game-State.
- Pro Raumsystem = ein Host (erste Person im System oder stabilster Ping). Spieler in System N verbinden sich zu Host N.
- DataChannel-Typen: unreliable-ordered für Position/Velocity (häufig), reliable für Events (Abschuss, Dock, Trade).

### Prozedurale Welt
- Original-Elite-Algorithmus (Fibonacci-basierter Pseudo-Zufall, fester Seed) in TypeScript reimplementiert.
- Gleicher Seed = gleiche 2048 Systeme auf jedem Client → Welt-Geometrie muss nicht synchronisiert werden, nur dynamische Objekte (Schiffe, Preisschwankungen, Missionszustand).

## Wirtschaft

Pro System: `techLevel` (0–14), `government` (0–7: Anarchie → Polizeistaat), `economy` (Agro / Industriell). Alle Werte seed-basiert wie Original.

Waren (Original-Satz): Food, Textiles, Radioactives, Slaves, Liquor/Wines, Luxuries, Narcotics, Computers, Machinery, Alloys, Firearms, Furs, Minerals, Gold, Platinum, Gem-Stones, Alien Items.

- Preise + Verfügbarkeit aus Tech-Level/Economy abgeleitet plus Zufallsschwankung pro Tick (Arbitrage erhalten).
- Station-Markt = UI-Overlay (Babylon GUI). Kauf/Verkauf = Credits-Transaktion mit Laderaum-Limit.

## Factions

- **Polizei:** greift bei `legalStatus > 0` (ungerechtfertigter Abschuss). Skala: Clean → Offender → Fugitive.
- **Piraten:** Spawn-Rate abhängig von `government` (Anarchie = viele).
- **Händler:** neutral, fliegen Routen, bieten Gelegenheits-Targets.
- **Thargoiden:** Hypersprung-Misslung-Event + eigene Missionen. Oktogon-Mutterschiff + Thargon-Drohnen.

## Schiffe

Original-Typen reimplementiert: Cobra MkIII (Start), Cobra MkI, Sidewinder, Viper, Python, Anaconda, Mamba, Gecko, Krait, Transporter, Shuttle, Thargoid-Ship, Thargon.

Jedes Schiff: Stats (Geschwindigkeit, Agility, Schild/Hülle, Laderaum, Waffen-Slots, Preis). Mesh prozedural (Emissive-Edge-Material) oder als GLB-Asset.

Abschuss = Wrack → Loot-Cargo + Rettungskapsel scoopbar + verkaufbar. Abschuss-Punkte fließen in Rang (nichtlinear, Schiff-abhängig, 0–16 Punkte).

## Combat

4-View-System originalgetreu: Front, Rear, Left, Right (`1`/`2`/`3`/`4` oder Hat-Switch).

- Laser pro View-Slot installierbar (Pulse → Beam → Military).
- 3D-Radar: tangentialer Plot (Entfernung = Ring-Abstand, Position = Winkel).
- Raketen: zielsuchend, begrenztes Magazin. Energiebombe: AoE-Puls.
- Schild/Hülle-Regen, Energie-Management (Laser ziehen Energie).

## Docking

Koriolis-Station rotiert. Manuell: durch Schlitz anfliegen mit korrekter Rotation. Andockcomputer = Auto-Pilot (Extra-Ausrüstung).

Multiplayer-Twist: Station-Slot-Limit — bei vollem Host Queue. Docking-Failure = Tod (Original-Schmerz erhalten).

## Hypersprung

- Reichweite 7 LJ pro Tankfüllung. Galaktische Karte = Webb-Diagramm der Systeme.
- Sprung = Lade-Animation + Witch-Space. Misslung-Sprung = Thargoid-Interdict-Event.
- Galaktischer Sprung (Tech ≥ 11, 5000 Cr, einmalig) = nächste Galaxie.

## Missionen (C64-Vorbild)

1. **Constrictor-Jagd** — ab 100 Punkten in Galaxie 1/2: gestohlenen Schiffprototyp finden und zerstören.
2. **Thargoid-Kampfpläne** — ab 500 Punkten in Galaxie 3 (nach Mission 1): Datentransport unter Thargoiden-Angriffen.
3. **Trumbles** — ab 5000 Cr: Wesen kaufen, extrem vermehrungsfähig, können Spiel blockieren.

## Ränge

Abschussbasiert, Schwellen wie Original: 0 harmlos → 8 relativ harmlos → schwach → durchschnittlich → überdurchschnittlich → 128 kompetent → 512 gefährlich → 2560 tödlich → **6400 Elite**.

## Multiplayer-Sync-Protokoll

### Topologie
- Signaling-Server (PeerJS-Cloud oder Cloudflare Worker + Durable Object) = nur SDP/ICE. Kein Game-State.
- Pro Raumsystem ein Host (erste Person im System oder stabilster Ping). Spieler in System N connecten zu Host N.
- DataChannel: unreliable-ordered für Position/Velocity, reliable für Events.

### Host-Migration (Pfad b)
- Host snapshotet Welt alle 5 s (`worldSnapshot`: Schiffe, Projektile, Preisschwankung-Phase, Mission-State).
- Snapshot Round-Robin an alle Peers (jeder hält letzten Stand).
- Host-Disconnect erkannt via DataChannel `onclose` → Peer mit zuverlässigstem Snapshot wird neuer Host, Re-Sync ±1 Tick.
- Split-Brain bei Netz-Partition → beide Halbsysteme laufen; bei Reconnect Konfliktlösung nach höchstem `tickNumber` + Kills-Count (Last-Write-wins pro Spieler).

### Persistenz
- `localStorage` pro Client: `credits`, `kills`, `legalStatus`, `currentSystem`, Schiff-Ausrüstung, `galaxyIndex`, Missions-Fortschritt, Trumbles-Anzahl.
- Bei Host-Werden: Snapshot aus `localStorage` + empfangenen Peers mergen.
- Cheating-Isolation: eigener `kills`-Stand zählt für eigenen Rang. Fremde Ränge = Anzeigewert, nicht vertrauenswürdig → Co-op-Vibe, keine kompetitive Liga.

### Tick-Modell
- 20 Hz Sim-Tick, 60 Hz Render. Client-seitige Interpolation + Reconciliation (klassischer FPS-Netcode).
- Input → Host → bestätigt → Client rekonziliert.

## Bekannte Risiken

- **P2P + Host-Autorität + persistente Wirtschaft:** Host-Ausfall mitten in Trade/Combat = Weltzustand verloren/inkonsistent. Mit Host-Migration + Snapshot-Transfer (Pfad b) gemildert, nicht eliminiert.
- **Cheating:** Host manipulierbar (Preise, Abschüsse). Akzeptiert via Cheating-Isolation (nur eigener Stand zählt).
- **Scope:** Voll-Feature-Parität ist groß. Empfehlung: inkrementell bauen — erst Kern-Loop (Handel/Combat/Docking/1 Galaxie-Subset) grün, dann Missionen/Thargoiden/Trumbles/Galaxien-Wechsel schichtenweise.