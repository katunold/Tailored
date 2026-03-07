import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { resolveApiBase } from '../../core/api-base';

export interface MeasurementFieldDto {
  key: string;
  label: string;
  type: 'number' | 'text';
  required: boolean;
}

export interface MeasurementProductProfileDto {
  id: number;
  clientId: number;
  itemTypeId: number;
  itemTypeName: string;
  fields: MeasurementFieldDto[];
  valuesJson: string;
  updatedAt: string;
  values: Record<string, number | string>;
}

export interface MeasurementProfileDto {
  clientId: number;
  products: Array<{
    itemTypeId: number;
    itemTypeName: string;
    fields: MeasurementFieldDto[];
    measurementId: number | null;
    valuesJson: string | null;
    updatedAt: string | null;
    values: Record<string, number | string>;
  }>;
}

const FALLBACK_MEASUREMENT_FIELDS: MeasurementFieldDto[] = [
  { key: 'neck', label: 'Neck', type: 'number', required: false },
  { key: 'cabba', label: 'Cabba', type: 'number', required: false },
  { key: 'sleeves', label: 'Sleeves', type: 'number', required: false },
  { key: 'length', label: 'Length', type: 'number', required: false },
  { key: 'bust', label: 'Bust', type: 'number', required: false },
  { key: 'waist', label: 'Waist', type: 'number', required: false },
  { key: 'shoulders', label: 'Shoulders', type: 'number', required: false },
  { key: 'width', label: 'Width', type: 'number', required: false }
];

@Injectable({ providedIn: 'root' })
export class MeasurementsService {
  constructor(private readonly http: HttpClient) {}

  private readonly measurementsUrl = `${resolveApiBase()}/api/measurements`;

  getMeasurementFields(itemTypeId?: number): Observable<MeasurementFieldDto[]> {
    const suffix = itemTypeId ? `?itemTypeId=${itemTypeId}` : '';
    return this.http.get<MeasurementFieldDto[]>(`${this.measurementsUrl}/fields${suffix}`).pipe(
      map((fields) => (Array.isArray(fields) && fields.length > 0 ? fields : FALLBACK_MEASUREMENT_FIELDS)),
      catchError(() => of(FALLBACK_MEASUREMENT_FIELDS))
    );
  }

  getMeasurementProfile(clientId: number | string): Observable<MeasurementProfileDto> {
    return this.http.get<MeasurementProfileDto>(`${this.measurementsUrl}/profile/${clientId}`);
  }

  upsertMeasurementProfile(
    clientId: number | string,
    itemTypeId: number,
    values: Record<string, number | string>
  ): Observable<MeasurementProductProfileDto> {
    return this.http.put<MeasurementProductProfileDto>(`${this.measurementsUrl}/profile/${clientId}/${itemTypeId}`, {
      values
    });
  }
}
