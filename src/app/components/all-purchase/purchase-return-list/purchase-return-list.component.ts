import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PurchaseService } from '../../../services/purchase.service';
import { CustomerService } from '../../../services/customer.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { DateUtils } from '../../../shared/utils/date-utils';
import { EncryptionService } from '../../../shared/services/encryption.service';
import { AuthService } from '../../../services/auth.service';

interface PurchaseReturn {
  id: number;
  totalPurchaseAmount: number;
  purchaseReturnDate: string;
  invoiceNumber: string;
  customerName: string;
  purchaseId: number;
}

interface PurchaseReturnSearchRequest {
  currentPage: number;
  perPageRecord: number;
  search?: string;
  customerId?: number;
  purchaseId?: number;
  startDate?: string;
  endDate?: string;
  clientId: number;
}

interface PurchaseReturnResponse {
  content: PurchaseReturn[];
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
  selector: 'app-purchase-return-list',
  templateUrl: './purchase-return-list.component.html',
  styleUrls: ['./purchase-return-list.component.scss']
})
export class PurchaseReturnListComponent implements OnInit, OnDestroy {
  purchaseReturns: PurchaseReturn[] = [];
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
  isLoadingCustomers = false;
  canManagePurchases = false;

  // Client ID - can be made configurable
  clientId = 1;

  private destroy$ = new Subject<void>();

  constructor(
    private purchaseService: PurchaseService,
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
    this.canManagePurchases = this.authService.isAdmin() || this.authService.isStaffAdmin();
    this.loadPurchaseReturns();
    if (this.canManagePurchases) {
      this.loadCustomers();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      batchNumber: [''],
      customerId: [''],
      startDate: [''],
      endDate: ['']
    });
  }

  loadPurchaseReturns(): void {
    this.isLoading = true;
    const formValues = this.searchForm.value;

    const params: PurchaseReturnSearchRequest = {
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      clientId: this.clientId,
      search: formValues.search?.trim() || undefined,
      customerId: this.canManagePurchases && formValues.customerId ? Number(formValues.customerId) : undefined,
      startDate: formValues.startDate ? this.dateUtils.formatDate(formValues.startDate) : undefined,
      endDate: formValues.endDate ? this.dateUtils.formatDate(formValues.endDate) : undefined
    };

    // Remove undefined values
    Object.keys(params).forEach(key => {
      if (params[key as keyof PurchaseReturnSearchRequest] === undefined) {
        delete params[key as keyof PurchaseReturnSearchRequest];
      }
    });

    this.purchaseService.searchPurchaseReturn(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: PurchaseReturnResponse) => {
          this.purchaseReturns = response.content || [];
          this.totalPages = response.totalPages || 0;
          this.totalElements = response.totalElements || 0;
          this.updatePaginationIndexes();
          this.isLoading = false;
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || 'Failed to load purchase returns');
          this.isLoading = false;
        }
      });
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
    this.loadPurchaseReturns();
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadPurchaseReturns();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadPurchaseReturns();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadPurchaseReturns();
  }

  private loadCustomers(): void {
    if (!this.canManagePurchases) {
      return;
    }
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
    if (!this.canManagePurchases) {
      return;
    }
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

  viewDetails(id: number): void {
    const encryptedId = this.encryptionService.encrypt(id.toString());
    this.router.navigate(['/purchase/return', encryptedId]);
  }


  deletePurchaseReturn(id: number): void {
    if (confirm('Are you sure you want to delete this purchase return? This action cannot be undone.')) {
      this.isLoading = true;
      this.purchaseService.deletePurchaseReturn(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response?.success) {
              this.snackbar.success(response.message || 'Purchase return deleted successfully');
              this.loadPurchaseReturns();
            } else {
              this.snackbar.error(response?.message || 'Failed to delete purchase return');
              this.isLoading = false;
            }
          },
          error: (error) => {
            this.snackbar.error(error?.error?.message || 'Failed to delete purchase return');
            this.isLoading = false;
          }
        });
    }
  }
}
