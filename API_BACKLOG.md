# Trading Journal API Backlog

These enhancements need backend or external API work and are intentionally left as design-ready follow-ups.

## Market data

- Live BTC/ETH and watchlist quotes with timestamp/source metadata.
- Market-open/session status by exchange and timezone.
- Historical OHLCV candles for equity-curve overlays and trade replay.

## Analytics

- Server-side aggregation by symbol, setup, direction, session, market condition, and day of week.
- Drawdown series, expectancy, profit factor, R distribution, and rolling performance endpoints.
- Optional benchmark comparison against BTC, ETH, SPX, or a user-selected instrument.

## Trade media

- Supabase Storage upload lifecycle for screenshots and chart images.
- Image annotations with persistent vector/stroke metadata.
- Signed URLs, thumbnail generation, and deletion policies.

## Collaboration and reliability

- Audit history for edited/deleted trades.
- Background export jobs for large journals.
- Row-level validation for risk and position sizing calculations.
