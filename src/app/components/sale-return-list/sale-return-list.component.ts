import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SaleService } from '../../services/sale.service';
import { CustomerService } from '../../services/customer.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoaderComponent } from '../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { DateUtils } from '../../shared/utils/date-utils';
import { EncryptionService } from '../../shared/services/encryption.service';
import { AuthService } from '../../services/auth.service';

interface SaleReturn {
  id: number;
  totalSaleAmount: number;
  saleReturnDate: string;
  invoiceNumber: string;
  customerName: string;
  saleId: number;
}

interface SaleReturnSearchRequest {
  currentPage: number;
  perPageRecord: number;
  search?: string;
  customerId?: number;
  saleId?: number;
  startDate?: string;
  endDate?: string;
}

interface SaleReturnResponse {
  content: SaleReturn[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
  };
  totalElements: number;
  totalPages: number;
  last: boolean;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

@Component({
  selector: 'app-sale-return-list',
  templateUrl: './sale-return-list.component.html',
  styleUrls: ['./sale-return-list.component.scss']
})
export class SaleReturnListComponent implements OnInit, OnDestroy {
  saleReturns: SaleReturn[] = [];
  searchForm!: FormGroup;
  isLoading = false;

  // Pagination properties
  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  startIndex = 0;
  endIndex = 0;

  // Dropdown data
  customers: any[] = [];
  sales: any[] = [];
  isLoadingCustomers = false;
  isLoadingSales = false;

  private destroy$ = new Subject<void>();

  constructor(
    private saleService: SaleService,
    private customerService: CustomerService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private dateUtils: DateUtils,
    private encryptionService: EncryptionService,
    private router: Router,
    private authService: AuthService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadSaleReturns();
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      customerId: [''],
      saleId: [''],
      startDate: [''],
      endDate: ['']
    });
  }

  loadSaleReturns(): void {
    this.isLoading = true;
    const formValues = this.searchForm.value;

    const params: SaleReturnSearchRequest = {
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      search: formValues.search?.trim() || undefined,
      customerId: formValues.customerId ? Number(formValues.customerId) : undefined,
      saleId: formValues.saleId ? Number(formValues.saleId) : undefined,
      startDate: formValues.startDate ? this.formatDateForApi(formValues.startDate) : undefined,
      endDate: formValues.endDate ? this.formatDateForApi(formValues.endDate) : undefined
    };

    // Remove undefined values
    Object.keys(params).forEach(key => {
      if (params[key as keyof SaleReturnSearchRequest] === undefined) {
        delete params[key as keyof SaleReturnSearchRequest];
      }
    });

    this.saleService.searchSaleReturn(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: SaleReturnResponse) => {
          this.saleReturns = response.content || [];
          this.totalPages = response.totalPages || 0;
          this.totalElements = response.totalElements || 0;
          this.updatePaginationIndexes();
          this.isLoading = false;
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || 'Failed to load sale returns');
          this.isLoading = false;
        }
      });
  }

  private formatDateForApi(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  updatePaginationIndexes(): void {
    this.startIndex = this.currentPage * this.pageSize;
    this.endIndex = Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }

  onSearch(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.currentPage = 0;
    this.loadSaleReturns();
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.sales = [];
    this.loadSaleReturns();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadSaleReturns();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadSaleReturns();
  }

  private loadCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.getCustomers({ status: 'A' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.success && response.data) {
            this.customers = response.data;
          }
          this.isLoadingCustomers = false;
        },
        error: () => {
          this.snackbar.error('Failed to load customers');
          this.isLoadingCustomers = false;
        }
      });
  }

  refreshCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.refreshCustomers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response?.success && response.data) {
            this.customers = response.data;
            this.snackbar.success('Customers refreshed successfully');
          }
          this.isLoadingCustomers = false;
        },
        error: () => {
          this.snackbar.error('Failed to refresh customers');
          this.isLoadingCustomers = false;
        }
      });
  }

  loadSalesForCustomer(customerId: number): void {
    if (!customerId) {
      this.sales = [];
      return;
    }

    this.isLoadingSales = true;
    const params = {
      currentPage: 0,
      perPageRecord: 1000,
      customerId: customerId
    };

    this.saleService.searchSales(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response?.data?.content) {
            this.sales = response.data.content;
          } 
          this.isLoadingSales = false;
        },
        error: () => {
          this.snackbar.error('Failed to load sales');
          this.sales = [];
          this.isLoadingSales = false;
        }
      });
  }

  onCustomerChange(customerId: any): void {
    if (customerId) {
      this.loadSalesForCustomer(Number(customerId));
    } else {
      this.sales = [];
      this.searchForm.patchValue({ saleId: '' });
    }
  }

  viewDetails(id: number | undefined): void {
    if (!id) {
      this.snackbar.error('Sale ID is not available');
      return;
    }
    const encryptedId = this.encryptionService.encrypt(id.toString());
    this.router.navigate(['/sale/return', encryptedId]);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  }

  deleteSaleReturn(id: number): void {
    if (confirm('Are you sure you want to delete this sale return? This action cannot be undone.')) {
      this.isLoading = true;
      this.saleService.deleteSaleReturn(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response?.success) {
              this.snackbar.success(response.message || 'Sale return deleted successfully');
              this.loadSaleReturns();
            } else {
              this.snackbar.error(response?.message || 'Failed to delete sale return');
              this.isLoading = false;
            }
          },
          error: (error) => {
            this.snackbar.error(error?.error?.message || 'Failed to delete sale return');
            this.isLoading = false;
          }
        });
    }
  }
}
