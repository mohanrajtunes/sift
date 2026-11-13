# Sift: what's next (notes from the last session)

Done and saved: backend (streaming agent, graph, rate limits, file lines), frontend (home, repo, evals, built, repos pages),
page wipe transition, footer, home sections, repo stats/search/starters/copy, card-swing bug fix.

To do next:
1. DONE: Replace the "made by hand" stamp in src/components/HomeMore.jsx (About section) with a mini game.
   Idea: "Catch the nugget": a tiny sieve you move left/right to catch gold nuggets (cited files) and dodge junk (node_modules).
2. DONE: Peeking cat on every page: riso cat that peeks from page edges, eyes follow the cursor, hides when the cursor gets close.
   Put it in src/components/Cat.jsx and render it in App.jsx next to <Wipe />. Respect prefers-reduced-motion.
3. DONE: Custom "ticket punch" buttons everywhere: ticket shape, press = punch hole + small squash.
   Make one shared class (e.g. .tbtn in tokens.css) and use it for Index it, Ask, Copy answer, starters, Try again.
4. Test against the real backend locally, then deploy (steps in README.md, Deploy section).
5. After deploy: set og:image in frontend/index.html to the full URL.
