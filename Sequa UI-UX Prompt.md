# Sequa_prompt.md — UI/UX Build Spec

A standalone build prompt for the Sequa frontend. For this product the interface is not a layer on top of the value, it *is* the value: the shareable performance card is the viral engine and the one-tap follow is the entire user promise. This file is written to win two prizes at once: **Best UI/UX** and **Community Voting**. Hand it directly to the engineering pass. See `Sequa_project.md` for system architecture.

---

## Mission

Build the Sequa frontend in Next.js: a consumer app where anyone can browse verified AI trading agents on a leaderboard, follow one in a single tap so it mirrors trades into their own non-custodial wallet, and share a beautiful performance card that turns a good run into a post. It must feel like a product people screenshot without being asked, while staying credible enough that an institutional judge trusts the verified-on-chain badge.

## Design to the two prizes

**Best UI/UX** is scored on four weighted criteria. Design as if these are the grading sheet, because they are.

- **Visual Design (30%)** — a committed, distinctive aesthetic. The performance card is the hero object and must be exceptional.
- **Interaction & Flow (30%)** — the one-tap follow is the make-or-break moment; it must feel effortless and a little magical.
- **AI Interaction Design (25%)** — each agent reads as a character with a legible strategy personality, not a row in a table. You follow a *someone*, not a spreadsheet.
- **Accessibility (15%)** — a newcomer understands "follow this agent, it copies trades to my own wallet, I keep custody" in one screen, with no jargon wall.

**Community Voting** happens on X. The single highest-leverage asset in the entire build is the **shareable performance card**, because that image is what gets posted and voted on. Treat the card as the product's face. Every pixel of it is campaign material.

## Aesthetic direction (commit fully)

**The collectible trading-card arena.** Think premium sports-card meets a modern social-fintech leaderboard: agents are players, their cards are collectible and alive, the leaderboard is a standings board with stakes. Confident, energetic, and a little competitive, but refined, not loud crypto-casino. This is the opposite of an austere data dashboard; it should feel like following athletes.

Commit to these choices:

- **Theme:** a deep, rich base (consider a near-black ink or a deep saturated jewel tone) that makes the cards and grades glow, with one or two vivid, characterful accents. Dark gives the cards presence and reads premium on an X timeline. If you go light instead, make it a bold editorial almanac, not a default white SaaS panel; pick one and execute it completely.
- **Typography:** a distinctive, characterful display face for agent names, grades, and headline numbers, paired with a precise mono for tickers, returns, addresses, and metrics. The mono signals "real on-chain data," the display gives the card personality. **Do not use Inter, Roboto, Arial, or system fonts.**
- **Layout:** the card is always the largest, most considered object on any screen it appears in. Strong vertical rhythm on the leaderboard, generous focus on the agent profile. Intentional, not crowded.
- **Texture and depth:** the card should have real material quality, foil-like accents, subtle depth, a tactile sense of a collectible. Atmosphere and glow over flatness. Restraint elsewhere so the card carries the drama.

## Design tokens

Define everything as CSS variables: a neutral ink ramp for the chosen theme, one or two vivid accents and their tints, the performance-tier color system below, a type scale with display / heading / body / mono / caption, an 8px-based spacing scale, two radii, and layered shadow and glow levels for the card. Consistency across the app is itself a Visual Design score.

## Performance-tier color system

An agent's standing must read instantly without reading numbers. Build a coherent ramp, not arbitrary colors:

- **Elite / top performers:** a confident, premium family (consider a gold or luminous accent) that signals "follow this one."
- **Strong / mid:** a calm, positive family.
- **Underperforming / new:** a muted, neutral family, never punitive.

Tiers appear consistently on the card, the leaderboard row, and the agent profile via one reused component, so the visual language is unmistakable. Never rely on color alone; always pair with a label and the figure (also an Accessibility point).

## Core screens (these must exist)

### 1. Leaderboard (discovery, the home)
A standings board of verified agents, each row showing: agent name and avatar, performance tier, headline return, verified-on-chain badge, follower count, and a sparkline of recent performance. It should feel like opening league standings, scannable, competitive, alive. Sort and filter. Tapping a row opens the agent.

### 2. Agent profile + the performance card (the hero)
The centerpiece of the whole product. For a single agent: the large, collectible performance card; the verified-on-chain badge as a first-class trust element; the agent's strategy personality in plain language; recent moves; verified track record reconciled to on-chain history; follower count; ERC-8004 reputation as a portable credential. The card is the thing a user will screenshot and post, so it must be self-contained and beautiful on its own, readable out of context on an X timeline.

### 3. One-tap mirror flow (where Interaction & Flow is won)
Following must feel effortless and a little magical. One primary action to mirror, then a clean, reassuring step to set capital and a risk cap, then a transparent non-custodial authorization the user understands ("Sequa never holds your funds; you can revoke anytime"). Confirmation should feel like a moment, not a form submission. No dead ends, designed loading and success states throughout.

### 4. Your follows (portfolio)
What the user is mirroring, each agent's live contribution to their results, and a one-tap unfollow. Calm, legible, honest.

### 5. The share moment
Generate the performance card as a polished image and hand it to X in one tap, with the post pre-composed. This screen is the Community Voting engine; make sharing the most satisfying action in the app.

## AI Interaction Design requirements (25%)

- **Agents are characters, not rows.** Each source agent has a name, an avatar, and a legible strategy personality surfaced in plain language ("patient, trades majors, cuts losses fast"). Following should feel like backing a player.
- **Show recent moves as a story,** a readable timeline of what the agent did and why, not a raw trade log.
- **The verified-on-chain badge is a first-class UI element,** present wherever performance is claimed, with a way to see that the claim reconciles to on-chain history. This is the trust anchor that keeps the institutional judges on side.
- **Reputation is shown as a portable credential,** something the agent carries, not a number buried in a profile.

## Accessibility requirements (15%)

- Plain-language layer everywhere: the follow promise, custody, and risk are stated in one human sentence each, no jargon wall.
- Define terms inline on first use (mirror, non-custodial, risk cap, ERC-8004) via accessible tooltips or a glossary affordance.
- Full keyboard navigation, visible focus states, semantic HTML, real contrast ratios on the dark theme, and never tier-color alone to convey standing.
- Fully responsive; the card and the follow flow must be flawless on a phone, since that is where sharing and the live demo happen.

## Motion and interaction (30%)

- One well-orchestrated page load with staggered reveals on the leaderboard beats scattered micro-animations.
- The performance card should feel alive on the agent profile: a subtle foil or light shift, numbers that count up once on reveal.
- The follow confirmation is a signature moment: the tap, the authorization, the agent joining your follows. Make it feel like a win.
- The live mirror is the demo's spine: the source fires a signal, and the follower wallet visibly executes the same trade, scaled. Design this to read clearly on camera.
- Every async action has an intentional loading, empty, and error state.

## On-camera demo moments (design these to look great in the 2-minute video and as X media)

1. The leaderboard resolving into its standings.
2. The collectible performance card on the agent profile, foil and all.
3. The one-tap follow and its satisfying confirmation.
4. The live mirror: source signal, follower execution, side by side.
5. The share-to-X moment with the finished card.

## Tech constraints

- Next.js, the existing project stack.
- Implement dynamic share-card image generation so the card renders correctly as X media (Open Graph image generation).
- For any React artifact context, use only Tailwind core utilities and available libraries; keep state in React state, never browser storage.
- Load custom fonts properly so the distinctive typography actually renders for judges and in shared images.

## Hard anti-patterns (do not ship these)

- Generic AI-dashboard aesthetic: Inter or system fonts, purple-to-blue gradients on white, timid evenly-distributed color, predictable card grids.
- A performance claim with no verified-on-chain badge or no way to check it.
- Tier-color signaling with no label.
- A follow flow that hides custody or risk, or that reads as a dense form.
- A share card that looks like a screenshot of a dashboard rather than a designed, collectible object.
- Crypto-casino loudness; this is premium and competitive, not garish.

## Definition of done

A newcomer lands on the leaderboard, immediately sees which AI agents are worth following and that their records are verified on-chain, opens one, understands its style and its proof in plain language, follows it in one effortless tap while clearly keeping custody, watches it mirror a trade into their own wallet, and shares a performance card so good they want to post it. It should feel like a consumer product a real company shipped, not a hackathon entry. That is the Best UI/UX win, and the share card is what wins Community Voting alongside it.
