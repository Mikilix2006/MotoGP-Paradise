# MotoGP Stats

## Stack
- Node.js
- TypeScript
- Next.js
- React
- Tailwind CSS
- Lucide React

## Ejecutar
```bash
npm install
npm run dev
```

## API
### [MotoGP API](https://github.com/robschmitt/MotoGP-API)


## Flujos

### Countown
/api/next-gp <br>
      ▼ <br>
Temporada actual <br>
MotoGPSeason.id <br>
      ▼ <br>
/results/events?seasonUuid={seasonId} <br>
      ▼ <br>
Localizar evento por Circuit.id <br>
      ▼ <br>
event.id = eventUuid <br>
      ▼ <br>
categoryUuid de MotoGP <br>
      ▼ <br>
/results/sessions?eventUuid={eventUuid}&categoryUuid={categoryUuid} <br>
      ▼ <br>
Localizar: <br>
type === "R" <br>
      ▼ <br>
Validar domingo si hay varias carreras <br>
      ▼ <br>
session.id = sessionUuid <br>
      ▼ <br>
Obtener fecha y hora exactas <br>
      ▼ <br>
Countdown