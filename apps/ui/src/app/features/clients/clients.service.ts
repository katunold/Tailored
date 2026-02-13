import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ClientDto {
  id: number;
  fullName: string;
  phone: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientPayload {
  fullName: string;
  phone: string;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);
  private readonly clientsUrl = 'http://127.0.0.1:3030/api/clients';

  getClients(query = ''): Observable<ClientDto[]> {
    const trimmed = query.trim();
    const params = trimmed ? new HttpParams().set('query', trimmed) : undefined;

    return this.http.get<ClientDto[]>(this.clientsUrl, { params });
  }

  getClientById(id: number | string): Observable<ClientDto> {
    return this.http.get<ClientDto>(`${this.clientsUrl}/${id}`);
  }

  createClient(payload: CreateClientPayload): Observable<ClientDto> {
    return this.http.post<ClientDto>(this.clientsUrl, payload);
  }
}
