import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Employee } from '../../../models/employee.model';
import { EmployeeService } from '../../../services/employee.service';
import { FormsModule } from '@angular/forms';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { EncryptionService } from '../../../shared/services/encryption.service';



@Component({
  selector: 'app-attendance-list',
  templateUrl: './attendance-list.component.html',
  styleUrl: './attendance-list.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    LoaderComponent,
    RouterLink,
    RouterModule,
    PaginationComponent,
    SearchableSelectComponent
  ]
})
export class AttendanceListComponent {
  employees: Employee[] = [];
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

  constructor(
    private employeeService: EmployeeService,
    private fb: FormBuilder,
    private snackbar: SnackbarService,
    private router: Router,
    private encryptionService: EncryptionService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadEmployees();
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
    //   sortBy: ['id'],
    //   sortDir: ['asc']
    });
  }

  loadEmployees(): void {
    this.isLoading = true;
    const params = {
      ...this.searchForm.value,
      page: this.currentPage,
      size: this.pageSize
    };

    this.employeeService.searchEmployees(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.employees = response.data.content;
          this.totalPages = response.data.totalPages;
          this.totalElements = response.data.totalElements;
          this.updatePaginationIndexes();
        }
        this.isLoading = false;
      },
      error: () => {
        this.snackbar.error('Failed to load employees');
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.pageSize = 10;
    this.loadEmployees();
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.pageSize = 10;
    this.loadEmployees();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadEmployees();
  }

  deleteEmployee(id: number): void {
    if (confirm('Are you sure you want to delete this employee?')) {
      this.isLoading = true;
      this.employeeService.deleteEmployee(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Employee deleted successfully');
            this.loadEmployees();
          }
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to delete employee');
          this.isLoading = false;
        }
      });
    }
  }

  onPageChange(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadEmployees();
    }
  }

  private updatePaginationIndexes(): void {
    this.startIndex = this.currentPage * this.pageSize;
    this.endIndex = Math.min(this.startIndex + this.pageSize, this.totalElements);
  }

  viewAttendanceDetails(employeeId: number): void {
    this.isLoading = true;
    this.employeeService.getEmployeeDetail(employeeId).subscribe({
      next: (response) => {
        if (response.success) {
          const encryptedData = this.encryptionService.encrypt(JSON.stringify(response.data));
          localStorage.setItem('selectedEmployee', encryptedData);
          this.router.navigate(['/attendance/details']);
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error.message || 'Failed to load employee details');
        this.isLoading = false;
      }
    });
  }

}
