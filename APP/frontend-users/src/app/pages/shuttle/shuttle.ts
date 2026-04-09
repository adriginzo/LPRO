import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Subscription,
  catchError,
  forkJoin,
  interval,
  of,
  startWith,
  switchMap,
} from 'rxjs';

type ShuttleStatusApi = {
  status: string;
  lat: number;
  lng: number;
  last_position_at: string;
  free_seats: number;
  last_occupancy_at: string;
};

@Component({
  selector: 'app-shuttle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shuttle.html',
  styleUrls: ['./shuttle.css'],
})
export class ShuttleComponent implements AfterViewInit, OnDestroy {
  loading = true;
  errorMessage = '';

  statusLabel = '—';
  positionUpdatedLabel = '—';
  occupancyValue = '—';
  occupancyUpdatedLabel = '—';
  coordinatesLabel = '—';

  lastStatusRaw: ShuttleStatusApi | null = null;

  private readonly shuttleStatusApiUrl = '/shuttle-api/status';
  private readonly routeGeoJsonUrl =
    '/brain-assets/wp-content/plugins/brain-shuttle-map-admin/assets/route.geojson';
  private readonly stopsGeoJsonUrl =
    '/brain-assets/wp-content/plugins/brain-shuttle-map-admin/assets/stops.geojson';

  private readonly refreshMs = 1000;
  private readonly maxSeats = 8;
  private readonly defaultCenter: [number, number] = [42.171138, -8.684384];

  private pollSub?: Subscription;
  private relativeTimeSub?: Subscription;
  private staticLayersSub?: Subscription;

  private map: any = null;
  private L: any = null;
  private shuttleMarker: any = null;

  private routeOutlineLayer: any = null;
  private routeLayer: any = null;
  private stopsLayer: any = null;

  private staticLayersLoaded = false;
  private initialViewportSet = false;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  async ngAfterViewInit(): Promise<void> {
    await this.initMap();
    this.loadStaticMapLayers();
    this.startPolling();
    this.startRelativeTimeRefresh();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.relativeTimeSub?.unsubscribe();
    this.staticLayersSub?.unsubscribe();

    if (this.map) {
      this.map.remove();
      this.map = null;
      this.shuttleMarker = null;
      this.routeOutlineLayer = null;
      this.routeLayer = null;
      this.stopsLayer = null;
    }
  }

  goBack(): void {
    this.router.navigate(['/user-area']);
  }

  private startPolling(): void {
    this.pollSub = interval(this.refreshMs)
      .pipe(
        startWith(0),
        switchMap(() => this.http.get<ShuttleStatusApi>(this.shuttleStatusApiUrl))
      )
      .subscribe({
        next: (payload) => {
          this.ngZone.run(() => {
            this.applyStatus(payload);
          });
        },
        error: (error) => {
          console.error('Shuttle GET error:', error);

          this.ngZone.run(() => {
            this.loading = false;
            this.errorMessage =
              'Could not load shuttle data through the Angular proxy.';
            this.cdr.detectChanges();
          });
        },
      });
  }

  private startRelativeTimeRefresh(): void {
    this.relativeTimeSub = interval(1000).pipe(startWith(0)).subscribe(() => {
      this.refreshRelativeLabels();
    });
  }

  private loadStaticMapLayers(): void {
    if (!this.map || !this.L || this.staticLayersLoaded) return;

    this.staticLayersSub = forkJoin({
      route: this.http.get<any>(this.routeGeoJsonUrl).pipe(
        catchError((error) => {
          console.error('Route GeoJSON error:', error);
          return of(null);
        })
      ),
      stops: this.http.get<any>(this.stopsGeoJsonUrl).pipe(
        catchError((error) => {
          console.error('Stops GeoJSON error:', error);
          return of(null);
        })
      ),
    }).subscribe(({ route, stops }) => {
      this.ngZone.run(() => {
        if (route) {
          this.addRouteLayer(route);
        }

        if (stops) {
          this.addStopsLayer(stops);
        }

        this.fitMapToStaticLayers();
        this.staticLayersLoaded = true;
        this.cdr.detectChanges();
      });
    });
  }

  private addRouteLayer(routeGeoJson: any): void {
    if (!this.map || !this.L || !routeGeoJson) return;

    if (this.routeOutlineLayer) {
      this.map.removeLayer(this.routeOutlineLayer);
      this.routeOutlineLayer = null;
    }

    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }

    this.routeOutlineLayer = this.L.geoJSON(routeGeoJson, {
      style: () => ({
        color: '#ffffff',
        weight: 10,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }),
    }).addTo(this.map);

    this.routeLayer = this.L.geoJSON(routeGeoJson, {
      style: () => ({
        color: '#2563eb',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }),
    }).addTo(this.map);
  }

  private addStopsLayer(stopsGeoJson: any): void {
    if (!this.map || !this.L || !stopsGeoJson) return;

    if (this.stopsLayer) {
      this.map.removeLayer(this.stopsLayer);
      this.stopsLayer = null;
    }

    this.stopsLayer = this.L.geoJSON(stopsGeoJson, {
      pointToLayer: (_feature: any, latlng: any) =>
        this.L.circleMarker(latlng, {
          radius: 5,
          color: '#2563eb',
          weight: 3,
          fillColor: '#ffffff',
          fillOpacity: 1,
        }),
      onEachFeature: (feature: any, layer: any) => {
        const stopName = this.getStopName(feature);

        if (stopName) {
          layer.bindTooltip(stopName, {
            permanent: true,
            direction: 'top',
            offset: [0, -10],
            className: 'shuttle-stopLabel',
          });

          layer.bindPopup(`<strong>${stopName}</strong>`);
        }
      },
    }).addTo(this.map);
  }

  private getStopName(feature: any): string {
    const props = feature?.properties || {};

    return (
      props.name ||
      props.stop_name ||
      props.title ||
      props.label ||
      props.parada ||
      props.stop ||
      ''
    );
  }

  private fitMapToStaticLayers(): void {
    if (!this.map) return;

    let bounds: any = null;

    if (this.routeLayer && typeof this.routeLayer.getBounds === 'function') {
      const routeBounds = this.routeLayer.getBounds();
      if (routeBounds?.isValid?.()) {
        bounds = routeBounds;
      }
    }

    if (!bounds && this.stopsLayer && typeof this.stopsLayer.getBounds === 'function') {
      const stopBounds = this.stopsLayer.getBounds();
      if (stopBounds?.isValid?.()) {
        bounds = stopBounds;
      }
    }

    if (bounds?.isValid?.()) {
      this.map.fitBounds(bounds.pad(0.08));
      this.initialViewportSet = true;
    }
  }

  private applyStatus(payload: ShuttleStatusApi): void {
    this.lastStatusRaw = payload;
    this.loading = false;
    this.errorMessage = '';

    this.statusLabel = this.mapStatus(payload.status);
    this.occupancyValue = `${this.safeFreeSeats(payload.free_seats)}/${this.maxSeats} free seats`;
    this.coordinatesLabel = `${payload.lat.toFixed(6)}, ${payload.lng.toFixed(6)}`;

    this.refreshRelativeLabels();
    this.updateMapMarker(payload);
    this.cdr.detectChanges();
  }

  private refreshRelativeLabels(): void {
    if (!this.lastStatusRaw) {
      this.positionUpdatedLabel = '—';
      this.occupancyUpdatedLabel = '—';
      return;
    }

    this.positionUpdatedLabel = `Last position: ${this.formatRelativeTime(
      this.lastStatusRaw.last_position_at
    )}`;
    this.occupancyUpdatedLabel = `Last occupancy: ${this.formatRelativeTime(
      this.lastStatusRaw.last_occupancy_at
    )}`;
  }

  private mapStatus(status: string): string {
    const normalized = (status || '').trim().toLowerCase();

    switch (normalized) {
      case 'operating':
        return 'Operating';
      case 'idle':
        return 'Idle';
      case 'offline':
        return 'Offline';
      case 'out_of_service':
        return 'Out of service';
      default:
        return normalized
          ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
          : 'Unknown';
    }
  }

  private safeFreeSeats(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(this.maxSeats, Math.round(value)));
  }

  private formatRelativeTime(iso: string): string {
    const date = new Date(iso);

    if (isNaN(date.getTime())) {
      return 'unknown';
    }

    const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    if (diffSeconds < 5) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} d ago`;
  }

  private async initMap(): Promise<void> {
    const leaflet = await import('leaflet');
    this.L = leaflet;

    this.map = this.L.map('shuttle-map', {
      center: this.defaultCenter,
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '',
    }).addTo(this.map);

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 0);
  }

  private updateMapMarker(payload: ShuttleStatusApi): void {
    if (!this.map || !this.L) return;
    if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) return;

    const position: [number, number] = [payload.lat, payload.lng];

    if (!this.shuttleMarker && payload.lat!=0.0) {
      const icon = this.L.divIcon({
        className: '',
        html: `
          <div style="
            width: 42px;
            height: 42px;
            border-radius: 999px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 10px 24px rgba(37, 99, 235, 0.28);
            border: 3px solid rgba(255,255,255,0.96);
          ">🚌</div>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        popupAnchor: [0, -18],
      });

      this.shuttleMarker = this.L.marker(position, { icon }).addTo(this.map);
    } else {
      this.shuttleMarker.setLatLng(position);
    }

    this.shuttleMarker.bindPopup(`
      <div style="min-width: 180px;">
        <strong>Shuttle</strong><br>
        Status: ${this.mapStatus(payload.status)}<br>
        Free seats: ${this.safeFreeSeats(payload.free_seats)}/${this.maxSeats}<br>
        Coordinates: ${payload.lat.toFixed(6)}, ${payload.lng.toFixed(6)}
      </div>
    `);

    if (!this.initialViewportSet) {
      this.map.setView(position, 16);
      this.initialViewportSet = true;
    }
  }
}