import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TransportService } from '../../../services/transport.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-transport-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LoaderComponent,
    FormsModule,
    ConfirmModalComponent,
    PaginationComponent
  ],
  templateUrl: './transport-list.component.html',
  styleUrls: ['./transport-list.component.scss']
})
export class TransportListComponent implements OnInit {
  transports: any[] = [];
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

  // Add these properties
  showDeleteModal = false;
  transportToDelete: number | null = null;

  constructor(
    private transportService: TransportService,
    private fb: FormBuilder,
    private snackbar: SnackbarService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadTransports();
  }

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      search: [''],
      startDate: [null],
      endDate: [null]
    });
  }

  private formatDateForApi(dateStr: string, isStartDate: boolean): string {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const time = isStartDate ? '00:00:00' : '23:59:59';

    return `${day}-${month}-${year} ${time}`;
  }

  loadTransports(): void {
    this.isLoading = true;
    const formValues = this.searchForm.value;
    
    const params = {
      currentPage: this.currentPage,
      perPageRecord: this.pageSize,
      startDate: formValues.startDate ? this.formatDateForApi(formValues.startDate, true) : null,
      endDate: formValues.endDate ? this.formatDateForApi(formValues.endDate, false) : null,
      search: formValues.search?.trim() || '',
      sortBy: 'id',
      sortDir: 'desc'
    };

    this.transportService.searchTransports(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.transports = response.data.content;
          this.totalPages = response.data.totalPages;
          this.totalElements = response.data.totalElements;
          this.updatePaginationIndexes();
        }
        this.isLoading = false;
      },
      error: () => {
        this.snackbar.error('Failed to load transports');
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 0;
    this.loadTransports();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadTransports();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadTransports();
  }

  private updatePaginationIndexes(): void {
    this.startIndex = this.currentPage * this.pageSize;
    this.endIndex = Math.min(this.startIndex + this.pageSize, this.totalElements);
  }

  getPageNumbers(): number[] {
    const pageNumbers: number[] = [];
    const currentPage = this.currentPage + 1;

    if (this.totalPages <= 5) {
      for (let i = 1; i <= this.totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pageNumbers.push(i);
        }
      } else if (currentPage >= this.totalPages - 2) {
        for (let i = this.totalPages - 4; i <= this.totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pageNumbers.push(i);
        }
      }
    }

    return pageNumbers;
  }

  resetForm(): void {
    this.searchForm.reset();
    this.currentPage = 0;
    this.loadTransports();
  }

  // Add these methods
  onDeleteTransport(id: number): void {
    this.transportToDelete = id;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (this.transportToDelete) {
      this.isLoading = true;
      this.transportService.deleteTransport(this.transportToDelete).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Transport deleted successfully');
            this.loadTransports();
          } else {
            this.snackbar.error(response.message || 'Failed to delete transport');
          }
          this.cancelDelete();
          this.isLoading = false;
        },
        error: () => {
          this.snackbar.error('Failed to delete transport');
          this.cancelDelete();
          this.isLoading = false;
        }
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.transportToDelete = null;
  }

  onPrintTransport(id: number): void {
    this.transportService.generatePdf(id).subscribe({
      next: (response) => {
        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.filename;
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackbar.error('Failed to generate PDF');
      }
    });
  }
}
