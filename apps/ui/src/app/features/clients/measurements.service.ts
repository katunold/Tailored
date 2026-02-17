import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { resolveApiBase } from '../../core/api-base';

export interface MeasurementFieldDto {
  key: string;
  label: string;
  type: 'number' | 'text';
  required: boolean;
}

export interface MeasurementProfileDto {
  id: number;
  clientId: number;
  valuesJson: string;
  updatedAt: string;
  values: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class MeasurementsService {
  private readonly http = inject(HttpClient);
  private readonly measurementsUrl = `${resolveApiBase()}/api/measurements`;

  getMeasurementFields(): Observable<MeasurementFieldDto[]> {
    return this.http.get<MeasurementFieldDto[]>(`${this.measurementsUrl}/fields`);
  }

  getMeasurementProfile(clientId: number | string): Observable<MeasurementProfileDto | null> {
    return this.http.get<MeasurementProfileDto | null>(`${this.measurementsUrl}/profile/${clientId}`);
  }

  upsertMeasurementProfile(
    clientId: number | string,
    values: Record<string, number>
  ): Observable<MeasurementProfileDto> {
    return this.http.put<MeasurementProfileDto>(`${this.measurementsUrl}/profile/${clientId}`, {
      values
    });
  }
}
