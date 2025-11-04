import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterLink, RouterModule } from '@angular/router';
import { EmployeeOrderService } from '../../../services/employee-order.service';
import { EmployeeOrder } from '../../../models/employee-order.model';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { DateUtils } from '../../../shared/utils/date-utils';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-employee-order-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    LoaderComponent,
    SearchableSelectComponent,
    RouterLink,
    PaginationComponent
  ],
  templateUrl: './employee-order-list.component.html',
  styleUrls: ['./employee-order-list.component.scss']
})
export class EmployeeOrderListComponent implements OnInit {
  employeeOrders: EmployeeOrder[] = [];
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

  statusOptions = [
    { label: 'All', value: '' },
    { label: 'Open', value: 'O' },
    { label: 'In Progress', value: 'P' },
    { label: 'Completed', value: 'C' },
    { label: 'Inactive', value: 'I' }
  ];

  constructor(
    private employeeOrderService: EmployeeOrderService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private dateUtils: DateUtils
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadEmployeeOrders();
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      status: [''],
      startDate: [null],
      endDate: [null]
    });
  }

  loadEmployeeOrders(): void {
    this.isLoading = true;
    const formValues = this.searchForm.value;
    
    const params = {
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      ...formValues,
      startDate: formValues.startDate ? this.dateUtils.formatDateForApi(formValues.startDate, true) : null,
      endDate: formValues.endDate ? this.dateUtils.formatDateForApi(formValues.endDate, true) : null
    };

    this.employeeOrderService.searchEmployeeOrders(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.employeeOrders = response.data.content;
          this.totalPages = response.data.totalPages;
          this.totalElements = response.data.totalElements;
          this.updatePaginationIndexes();
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load employee orders');
        this.isLoading = false;
      }
    });
  }

  private updatePaginationIndexes(): void {
    this.startIndex = this.currentPage * this.pageSize;
    this.endIndex = Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadEmployeeOrders();
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadEmployeeOrders();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadEmployeeOrders();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadEmployeeOrders();
  }

  deleteEmployeeOrder(id: number): void {
    if (confirm('Are you sure you want to delete this employee order?')) {
      this.isLoading = true;
      this.employeeOrderService.deleteEmployeeOrder(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Employee order deleted successfully');
            this.loadEmployeeOrders();
          }
        },
        error: (error) => {
          this.snackbar.error(error.message || 'Failed to delete employee order');
          this.isLoading = false;
        }
      });
    }
  }

  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
} 