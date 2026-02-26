# TODO: DM & Automation Integration

## Part 1: Database Settings
- [ ] Update src/utils/database.js to add dm_transcripts and dm_alerts settings

## Part 2: Ticket Handler DM
- [ ] Implement enhanced DM with transcript attachment
- [ ] Add strict try/catch for user.send()
- [ ] Log failures to console and optionally to log channel

## Part 3: Automation (ready.js)
- [ ] Verify/setInterval for auto-close
- [ ] Implement SLA alerts reading from settings
- [ ] Implement Smart Ping from settings
