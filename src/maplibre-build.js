import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url'
import { MercatorCoordinate } from 'maplibre-gl/src/geo/mercator_coordinate.ts'
import { Map } from 'maplibre-gl/src/ui/map.ts'
import { AttributionControl } from 'maplibre-gl/src/ui/control/attribution_control.ts'
import { ScaleControl } from 'maplibre-gl/src/ui/control/scale_control.ts'
import { config } from 'maplibre-gl/src/util/config.ts'

config.WORKER_URL = workerUrl

export {
  AttributionControl,
  Map,
  MercatorCoordinate,
  ScaleControl,
}
