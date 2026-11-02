# Global YouTube player

All routes render a single player outside `Routes` in `App.jsx`. Navigation and folding preserve the same iframe; explicit Stop removes it. Playback is local to the current browser tab and is not broadcast to canvas participants. Reloading the page ends playback.

Open the music button, paste a video link, and press Open. Drag the header to reposition; drag the bottom corner or use its arrow keys to resize. Compact listening view retains the official visible YouTube embed. No audio extraction or hidden audio stream is implemented.

The app does not force native YouTube captions on. Native captions, if enabled by the viewer or YouTube preferences, remain inside the official player. The official iframe API does not expose caption cue text, so external captions use a user supplied SRT or VTT file. These cues follow player time and render at viewport bottom center. Canvas routes reserve space above the quick dock. The launcher scans visible dock, panel, minimap and viewport controls to find an unoccupied position and updates after layout changes. Files are parsed locally as plain text, limited to 2 MB, and never uploaded. Caption source markup is stripped and React escapes text.

Only exact YouTube hosts and 11-character video IDs are accepted. Embeds use HTTPS and an origin-bound API, validate message source and origin, and send a Referer for YouTube client identification. External playback may be blocked by the video's owner, region, browser autoplay policy, or network. No third-party request is made before a video link is opened.

Official references: https://developers.google.com/youtube/iframe_api_reference and https://developers.google.com/youtube/player_parameters
