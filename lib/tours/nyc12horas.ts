export type TourStop = {
  name: string;
  convey: string; // qué transmitir en esta parada (guía para Henry, no literal)
  walkToNext?: string; // cómo seguir a la próxima
  address?: string;
};

export type Tour = {
  id: string;
  title: string;
  openingMessage: string; // primer mensaje de Henry (en su voz)
  stops: TourStop[];
  closingHint: string; // qué transmitir al cerrar
  knowledge: string; // itinerario completo → grounding
};

export const NYC12: Tour = {
  id: "nyc12horas",
  title: "12 horas en Nueva York desde JFK",

  openingMessage:
    "¡Eyy, bienvenido a Nueva York! 🗽 Soy Henry. Tenemos 12 horas y las vamos a exprimir. Primero lo primero: sácate una MetroCard y cárgale $15. Agarra el AirTrain hasta Howard Beach y de ahí la línea A, 12 paradas hasta High St (son como $10.75). Si andas corto de tiempo un taxi sale $70, pero el subte es la movida. Cuando salgas del subte avísame y te llevo a la primera parada 🤙",

  stops: [
    {
      name: "DUMBO",
      convey:
        "Una de las zonas favoritas de Henry para sentir la grandeza de Manhattan. Parándote en Washington St con Water St y mirando entre los edificios está la foto más famosa de la ciudad, con el puente de Manhattan detrás. Que se saque la foto.",
      walkToNext:
        "Subir por Washington 3 cuadras hasta Prospect St, hacia la escalera del puente de Brooklyn.",
      address: "Washington St & Water St, Brooklyn",
    },
    {
      name: "Puente de Brooklyn",
      convey:
        "Acá está la escalera famosa para subir al puente. Cruzarlo caminando hacia Manhattan es de lo mejor del día; que se tome el tiempo con las vistas.",
      walkToNext: "Del otro lado, agarrar por Park Row.",
    },
    {
      name: "Saint Paul's Chapel",
      convey: "Una pausa de historia en plena city.",
      walkToNext:
        "Caminar 3 cuadras por Park Row hasta Broadway y avanzar media cuadra.",
    },
    {
      name: "World Trade Center",
      convey:
        "Zona que mezcla historia, memoria y modernidad: el Memorial 9/11, el museo y el One World Observatory. Si va a entrar a algo pago, conviene comprarlo con anticipación.",
      walkToNext:
        "Caminar 12 min (850 m) por Greenwich, Cedar, Zuccotti Park y Broadway.",
    },
    {
      name: "Charging Bull",
      convey: "El toro de Wall Street: la foto clásica.",
      walkToNext:
        "5 min (450 m): 2 cuadras por Broadway y a la derecha por Wall St.",
    },
    {
      name: "New York Stock Exchange",
      convey: "Pararse frente a la puerta principal, puro Wall Street.",
      walkToNext:
        "Caminar 1 cuadra (Water con Broadway), tomar la línea 4, 4 paradas hasta Grand Central-42 St.",
    },
    {
      name: "Grand Central Terminal",
      convey:
        "La terminal más icónica de la ciudad; que mire para arriba, el techo y el reloj.",
      walkToNext: "Ya estás en el corazón de Midtown.",
    },
    {
      name: "Midtown Manhattan",
      convey:
        "El corazón vibrante: Times Square, Empire State, Broadway. Si no le da el tiempo, que corte cosas y busque algo de comer, que lo va a necesitar antes de volver al aeropuerto.",
      walkToNext: "Subir al Upper East Side.",
    },
    {
      name: "Upper East Side",
      convey:
        "Uno de los barrios más adinerados: restaurantes elegantes y tiendas de diseñador para cerrar el recorrido.",
    },
  ],

  closingHint:
    "Cerrar las 12 horas con cariño: celebrar lo recorrido, recordar calcular bien el tiempo para volver a JFK, y despedirse en personaje (un abrazo, que vuelva cuando quiera).",

  knowledge: `ITINERARIO DE 12 HORAS — NUEVA YORK DESDE JFK (de Henry)

1. TRASLADO JFK → DUMBO (aprox. 1 hora)
- Taxi/Uber/Lyft: $70
- AirTrain + Subway: $10.75 (recomendado)
- Ruta económica: AirTrain desde el terminal de llegada hasta Howard Beach, transbordo a la línea A del Subway por 12 paradas hasta la estación High St.
- Tarjeta de metro: se recomienda cargar $15.

2. DUMBO — Washington St y Water St.
- La foto más famosa de la ciudad, con el puente de Manhattan detrás.
- "Una de las zonas que más me gustan para apreciar la grandeza de la isla de Manhattan."

3. PUENTE DE BROOKLYN.
- Está la famosa escalera para empezar a recorrer el puente.
- Ruta: subir la calle Washington 3 cuadras hasta la intersección con Prospect St.

4. SAINT PAUL CHURCH (Saint Paul's Chapel).
- Caminar 3 cuadras por Park Row hasta la intersección con Broadway y avanzar media cuadra.

5. WORLD TRADE CENTER DISTRICT — sur de Manhattan.
- Combina historia, memoria y modernidad. Memorial 9/11, museo, One World Observatory.
- Caminar 12 min (850 m) vía Greenwich St, Cedar St, Zuccotti Park, Broadway.

6. CHARGING BULL (Toro de Wall Street).
- 12 min de caminata desde el WTC.

7. NEW YORK STOCK EXCHANGE.
- Caminar 5 min (450 m): 2 cuadras por Broadway, voltear a la derecha por Wall St. Está al frente de la puerta principal del NYSE.

8. GRAND CENTRAL TERMINAL.
- Caminar 1 cuadra (Water St con Broadway) y tomar la línea 4 por 4 paradas hasta la estación Grand Central-42 St.

9. MIDTOWN MANHATTAN.
- El corazón vibrante: rascacielos icónicos, teatros, tiendas. Times Square, Empire State Building, Broadway.
- "Si ven que no tienen mucho tiempo, corten algunas cosas y busquen algo de comer, que lo van a necesitar antes de regresar al aeropuerto."

10. UPPER EAST SIDE.
- Uno de los más adinerados de Nueva York; restaurantes elegantes y tiendas de diseñadores.

RECURSOS PRÁCTICOS
- Tarjeta de metro con $15 cargados.
- Si pensás entrar a alguna atracción paga, planificá con anticipación para comprar el ingreso.`,
};
