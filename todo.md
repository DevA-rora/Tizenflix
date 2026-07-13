# Todo
- [ ] In the "my list" section, there should be a top bar (apple TV style) to switch between the users liked, disliked, and loved movies
- [ ] Change focused button UI (to match youtube TV / netflix)
- [ ] Fix the episode picker in the player view (clicking on an episode doesn't )
- [ ] Fix the back button in the player.
- [ ] When the user clicks the search button, 
- [ ] Revamp player UI (it looks like ass rn)
- [ ] Integrate subDL + opensubtitles so that we can get subtitles with movies! (replace current picker)
opensubtitles is best for western movies, and subDL for non-western showings.
- [ ] Add ease in animation when the lefthandside toolbar/drawer is opened up.
- [ ] Add a loading ring when the source stuff is being loaded.
- [ ] Add settings for user to change default resolution + resolution while streaming.
- [ ] Consistent streams

# Doing
- [ ] Apply anchor effect from the homepage to episode selector.

# Done
- [x] Let the user select which language they want streams to play in (native or specific)
- [x] Add to settings the ability for the user to change the size of the grids. (small medium large)
- [x] Add new row to keyboard.
- [x] When typing in search, make sure that the button press down from the backspace lands on F, not on b
- [x] Fix weird row UI scrolling bug (skipping rows!?!)
- [x] When leaving search, make sure that you focus on the first movie, not the last movie in the row.
- [x] Change the weird colour gradient in the main view to match Netflix's.
- [x] port other tmdbprovider hot-path extractors to typescript
- [x] Add animations when moving between shows/movies (like Netflix)
- [x] Using this repository: https://github.com/streamflix-reborn/streamflix , see if we can use OR reverse engineer the servers present so that we should have literally no issues with streaming / API.
- [x] Using this repository: https://github.com/streamflix-reborn/streamflix , see how much code we can "steal".
- [x] Copy Netflix sidebar.
- [x] Revamp the UI using /frontend-design skill.
- [x] Be able to preview the application on laptop so I can make changes without having to be at the TV.
- [x] Netflix-style UI (sidebar, hero, browse rows) — browser testable at `:3010/app/index.html`
- [x] Movie/TV detail screens + Play → `app/js/screens/detail-*.js`
- [x] Organize app directory for UI development → `tizenflix-app/STRUCTURE.md`
- [x] Gate test passed (Inception + Off Campus episodes) → `tizenflix-app/RESULTS.md`
- [x] Research TizenBrew apps & build plan → `docs/tizenbrew-app-research.md`
- [x] Organize repo structure (`tizenflix-app/`, `lab/`, root README)
- [x] Initialize TizenBrew app package (`tizenflix-app/`)
- [x] Push + GitHub release v0.1.0 (LAN dev module)
- [x] Add `DevA-rora/Tizenflix` on TV (GitHub module) and run gate test
- [x] Fix Tizen TV UI (Tizen-safe CSS, bundled JS, focus, v0.1.1 commit)
