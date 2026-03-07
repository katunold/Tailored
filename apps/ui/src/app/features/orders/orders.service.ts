import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { OrderStatus } from '../../shared/status/status.types';
import { resolveApiBase } from '../../core/api-base';

interface ApiOrderItem {
  id: number;
  itemTypeId: number;
  quantity: number;
  color: string;
  material: string;
  notes?: string | null;
  measurementSnapshot?: Record<string, number>;
  itemType?: {
    name: string;
  } | null;
}

interface ApiOrder {
  id: number;
  status: string;
  notes?: string | null;
  createdAt?: string;
  dueDate: string | null;
  client?: {
    id?: number;
    fullName: string;
    phone?: string;
  } | null;
  items: ApiOrderItem[];
}

interface ApiItemType {
  id: number;
  name: string;
  category: string;
  isActive: boolean;
}

interface ApiItemTypeTemplate {
  itemTypeId: number;
  fields: Array<{
    key: string;
    label: string;
    type: 'number' | 'text';
    required: boolean;
  }>;
}

export interface ClientOrderRow {
  id: number;
  client: string;
  item: string;
  status: OrderStatus;
  deliveryDate: string | null;
}

export interface OrderItemType {
  id: number;
  name: string;
  category: string;
}

export interface OrderItemTemplateField {
  key: string;
  label: string;
  type: 'number' | 'text';
  required: boolean;
}

export interface CreateOrderPayload {
  clientId: number;
  status?: 'PLACED' | 'PROCESSING' | 'PAUSED' | 'COMPLETED' | 'CANCELED';
  dueDate?: string;
  notes?: string | null;
  items: Array<{
    itemTypeId: number;
    quantity: number;
    color?: string;
    material?: string;
    itemNotes?: string | null;
    otherProductName?: string | null;
    useCurrentMeasurements?: boolean;
    measurementsInput?: Record<string, number>;
  }>;
}

export type BackendOrderStatus = 'PLACED' | 'PROCESSING' | 'PAUSED' | 'COMPLETED' | 'CANCELED';

export interface OrderDetails {
  id: number;
  status: BackendOrderStatus;
  clientName: string;
  clientPhone: string | null;
  dueDate: string | null;
  createdAt: string | null;
  notes: string | null;
  items: Array<{
    id: number;
    itemTypeId: number;
    itemName: string;
    quantity: number;
    color: string;
    material: string;
    notes: string | null;
    measurements: Record<string, number>;
  }>;
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  constructor(private readonly http: HttpClient) {}

  private readonly ordersUrl = `${resolveApiBase()}/api/orders`;
  private readonly itemTypesUrl = `${resolveApiBase()}/api/item-types`;

  getOrdersByClient(clientId: number): Observable<ClientOrderRow[]> {
    const params = new HttpParams().set('clientId', String(clientId));

    return this.http.get<ApiOrder[]>(this.ordersUrl, { params }).pipe(
      map((orders) =>
        orders.map((order) => ({
          id: order.id,
          client: order.client?.fullName ?? 'N/A',
          item: this.toItemLabel(order.items),
          status: this.toUiStatus(order.status),
          deliveryDate: order.dueDate
        }))
      )
    );
  }

  getItemTypes(): Observable<OrderItemType[]> {
    return this.http.get<ApiItemType[]>(this.itemTypesUrl).pipe(
      map((itemTypes) =>
        itemTypes.map((itemType) => ({
          id: itemType.id,
          name: itemType.name,
          category: itemType.category
        }))
      )
    );
  }

  getItemTypeTemplate(itemTypeId: number): Observable<OrderItemTemplateField[]> {
    return this.http
      .get<ApiItemTypeTemplate>(`${this.itemTypesUrl}/${itemTypeId}/template`)
      .pipe(map((template) => template.fields ?? []));
  }

  createOrder(payload: CreateOrderPayload): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(this.ordersUrl, payload);
  }

  getOrders(query = '', status = ''): Observable<ClientOrderRow[]> {
    let params = new HttpParams();
    if (query.trim()) params = params.set('query', query.trim());
    if (status.trim()) params = params.set('status', status.trim());

    return this.http.get<ApiOrder[]>(this.ordersUrl, { params }).pipe(
      map((orders) =>
        orders.map((order) => ({
          id: order.id,
          client: order.client?.fullName ?? 'N/A',
          item: this.toItemLabel(order.items),
          status: this.toUiStatus(order.status),
          deliveryDate: order.dueDate
        }))
      )
    );
  }

  deleteOrder(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.ordersUrl}/${id}`);
  }

  getOrderById(id: number | string): Observable<OrderDetails> {
    return this.http.get<ApiOrder>(`${this.ordersUrl}/${id}`).pipe(
      map((order) => ({
        id: order.id,
        status: this.toBackendStatus(order.status),
        clientName: order.client?.fullName ?? 'N/A',
        clientPhone: order.client?.phone ?? null,
        dueDate: order.dueDate,
        createdAt: order.createdAt ?? null,
        notes: order.notes ?? null,
        items: (order.items ?? []).map((item) => ({
          id: item.id,
          itemTypeId: item.itemTypeId,
          itemName: item.itemType?.name ?? 'N/A',
          quantity: item.quantity ?? 1,
          color: item.color ?? 'Default',
          material: item.material ?? 'Standard',
          notes: item.notes ?? null,
          measurements: item.measurementSnapshot ?? {}
        }))
      }))
    );
  }

  updateOrderStatus(id: number | string, status: BackendOrderStatus): Observable<void> {
    return this.http.put<void>(`${this.ordersUrl}/${id}/status`, { status });
  }

  private toItemLabel(items: ApiOrderItem[]): string {
    const names = items.map((item) => item.itemType?.name).filter((name): name is string => Boolean(name));
    if (names.length === 0) {
      return 'N/A';
    }
    if (names.length === 1) {
      return names[0];
    }
    return `${names[0]} +${names.length - 1} more`;
  }

  private toUiStatus(status: string): OrderStatus {
    const map: Record<string, OrderStatus> = {
      PLACED: 'Placed',
      PROCESSING: 'Processing',
      PAUSED: 'Paused',
      COMPLETED: 'Completed',
      CANCELED: 'Canceled'
    };

    return map[status] ?? 'Placed';
  }

  private toBackendStatus(status: string): BackendOrderStatus {
    const allowed: BackendOrderStatus[] = ['PLACED', 'PROCESSING', 'PAUSED', 'COMPLETED', 'CANCELED'];
    if (allowed.includes(status as BackendOrderStatus)) {
      return status as BackendOrderStatus;
    }
    return 'PLACED';
  }
}
