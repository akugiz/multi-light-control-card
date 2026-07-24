# Multi-Light Control Card

A standalone Home Assistant dashboard card that controls several lights from one
place and displays your own named colour presets directly on the dashboard.

## Features

- add any number of `light` entity IDs;
- turn every selected light on or off with one press;
- apply one custom colour to every selected light;
- create custom colour buttons with a name, colour, and optional MDI icon;
- adjust the brightness of all selected lights together;
- optionally display individual light status and ON/OFF controls;
- visual card editor designed to keep focus during Home Assistant live updates;
- responsive, theme-aware layout.

## HACS installation

1. Open **HACS → Dashboard**.
2. Open the three-dot menu and choose **Custom repositories**.
3. Add:

   ```text
   https://github.com/akugiz/multi-light-control-card
   ```

4. Choose **Dashboard** as the category.
5. Download **Multi-Light Control Card** and refresh Home Assistant.

## Add the card

Edit a dashboard, choose **Add card**, and search for **Multi-Light Control Card**.
In the visual editor, paste a light entity ID into the first light row. Use
**Add light** to create more rows, and use the remove button to delete a light.

```yaml
type: custom:multi-light-control-card
title: Bedroom lights
entities:
  - light.example_ceiling
  - light.example_bedside
show_brightness: true
show_individual: true
colors:
  - name: Warm
    color: "#ffb46b"
    icon: mdi:weather-sunset
  - name: Blue
    color: "#4d8dff"
    icon: mdi:water
  - name: Purple
    color: "#b55cff"
    icon: mdi:creation
```

Pressing a colour preset calls `light.turn_on` for all configured entities with
the selected RGB colour. Lights that do not support RGB colours may ignore the
colour value; their normal ON/OFF control still works.

## Manual installation

1. Copy `multi-light-control-card.js` into `/config/www/`.
2. Add `/local/multi-light-control-card.js` as a JavaScript module under
   **Settings → Dashboards → Resources**.
3. Refresh Home Assistant.

## Safety

This is a community dashboard card. Test group controls with your devices after
installation.
