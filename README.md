# Klimakort

Dashboard-kort for Home Assistant. Det viser valgte enheter, en bryter som slår valgte automatiseringer av og på, og en glidebryter for måltemperatur.

- Gul glød utenpå kortet når bevegelsessensoren er på. Kortflaten beholder temafargen. Sensoren vises ikke.
- Rød glød utenpå kortet når alarm eller brannalarm er utløst. Rød har prioritet. De vises heller ikke.
- Knappen er borte. Hver ovn vises med enhetsnavnet og et ikon som slår den av eller på.
- Automatiseringsbryteren står til venstre. Gjeldende temperatur står til høyre, uten teksten «Er nå». Modus som «Varme» vises ikke.
- En mediespiller kan velges. Sangtittel og volumglidebryter vises bare mens den spiller.
- En temperatursensor kan overstyre «Er nå» fra klimaet.

[![Åpne i Marketplace](https://my.home-assistant.io/badges/marketplace_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=RunarG3&repository=glow-climate-card&category=plugin)

## Installer fra Marketplace

1. Åpne **Innstillinger → Marketplace**.
2. Velg **Legg til fra lenke**.
3. Lim inn `https://github.com/RunarG3/glow-climate-card`.
4. Kategori: **Dashboard**.
5. Installer **Klimakort** og legg kortet på oversikten.

Knappen over gjør det samme. På Home Assistant eldre enn 2026.11 heter det HACS. Bruk da [denne lenken](https://my.home-assistant.io/redirect/hacs_repository/?owner=RunarG3&repository=glow-climate-card&category=plugin) og kategori **Lovelace**.

## Konfigurasjon

Velg enhetene i korteditoren, eller bruk YAML:

```yaml
type: custom:glow-climate-card
name: Stue
entity: climate.stue
motion_entity: binary_sensor.stue_bevegelse
temperature_entity: sensor.stue_temperatur
alarm_entity: binary_sensor.alarm_sone_1
fire_entity: binary_sensor.royk_gang
automations:
  - automation.stue_klima
  - automation.stue_lys
entities:
  - light.stue_tak
  - cover.stue_persienner
ovens:
  - climate.stue_panelovn
media_player: media_player.stue
```

| Felt | Betydning |
| --- | --- |
| `entity` | Klima, valgfri. Glidebryteren vises bare når et klima er valgt. |
| `motion_entity` | Binær sensor. Gul glød, vises ikke. |
| `temperature_entity` | Valgfri. Overstyrer temperaturen fra klima. |
| `alarm_entity` / `fire_entity` | Valgfrie. Rød glød, vises ikke. |
| `automations` | Bryteren øverst slår alle av eller på. |
| `entities` | Lys, persienner og andre enheter på kortet. |
| `ovens` | Ovner. Navnet vises, ikonet slår av og på. |
| `media_player` | Valgfri. Viser sang og volum bare mens den spiller. |
