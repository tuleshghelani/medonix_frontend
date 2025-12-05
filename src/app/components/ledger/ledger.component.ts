import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { LedgerService } from '../../services/ledger.service';
import { CustomerService } from '../../services/customer.service';
import { SnackbarService } from '../../shared/services/snackbar.service';

@Component({
  selector: 'app-ledger',
  templateUrl: './ledger.component.html',
  styleUrls: ['./ledger.component.scss'],
  standalone: false
})
export class LedgerComponent implements OnInit, OnDestroy {
  ledgerForm!: FormGroup;
  customers: any[] = [];
  isLoading = false;
  isLoadingCustomers = false;
  isGeneratingPdf = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private ledgerService: LedgerService,
    private customerService: CustomerService,
    private snackbar: SnackbarService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    this.ledgerForm = this.fb.group({
      customerId: ['', Validators.required],
      startDate: [this.formatDateForInput(firstDayOfYear), Validators.required],
      endDate: [this.formatDateForInput(today), Validators.required]
    });
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatDateForApi(dateStr: string): string {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private loadCustomers(): void {
    this.isLoadingCustomers = true;
    this.customerService.getCustomers({ status: 'A' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
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
        next: (response: any) => {
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

  isFieldInvalid(fieldName: string): boolean {
    const field = this.ledgerForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  resetForm(): void {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    this.ledgerForm.patchValue({
      customerId: '',
      startDate: this.formatDateForInput(firstDayOfYear),
      endDate: this.formatDateForInput(today)
    });
    this.ledgerForm.markAsUntouched();
  }

  generatePdf(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Mark all fields as touched to show validation errors
    Object.keys(this.ledgerForm.controls).forEach(key => {
      this.ledgerForm.get(key)?.markAsTouched();
    });

    if (this.ledgerForm.invalid) {
      this.snackbar.error('Please fill all required fields');
      return;
    }

    const formValues = this.ledgerForm.value;

    // Validate date range
    const startDate = new Date(formValues.startDate);
    const endDate = new Date(formValues.endDate);

    if (startDate > endDate) {
      this.snackbar.error('Start date cannot be after end date');
      return;
    }

    this.isGeneratingPdf = true;

    const params = {
      customerId: Number(formValues.customerId),
      startDate: this.formatDateForApi(formValues.startDate),
      endDate: this.formatDateForApi(formValues.endDate)
    };

    this.ledgerService.generatePdf(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ blob, filename }) => {
          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();

          // Clean up
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          this.snackbar.success('Ledger report downloaded successfully');
          this.isGeneratingPdf = false;
        },
        error: (error: any) => {
          this.snackbar.error(error?.error?.message || 'Failed to generate ledger report');
          this.isGeneratingPdf = false;
        }
      });
  }

  getSelectedCustomerName(): string {
    const customerId = this.ledgerForm.get('customerId')?.value;
    if (!customerId) return '';
    const customer = this.customers.find(c => c.id === Number(customerId));
    return customer?.name || '';
  }
}
