import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Sale, SaleResponse, SaleSearchRequest } from '../models/sale.model';

@Injectable({
  providedIn: 'root'
})
export class SaleService {
  private apiUrl = `${environment.apiUrl}/api/sales`;

  constructor(private http: HttpClient) {}

  searchSales(params: SaleSearchRequest): Observable<SaleResponse> {
    return this.http.post<SaleResponse>(`${this.apiUrl}/searchSale`, params);
  }

  createSale(sale: Sale): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, sale);
  }

  updateSale(sale: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, sale);
  }

  deleteSale(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getSaleDetails(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/detail`, { id });
  }

  createFromQuotationItems(quotationItemIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/createFromQuotationItems`, { quotationItemIds });
  }

  generatePdf(id: number): Observable<{ blob: Blob; filename: string }> {
    return this.http.post(`${this.apiUrl}/generate-pdf`, { id }, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      map(response => {
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 'sale.pdf';
        const blob = new Blob([response.body!], { type: 'application/pdf' });
        return { blob, filename };
      })
    );
  }
}