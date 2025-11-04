import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { Product, ProductMainType, PolyCarbonateType, PolyCarbonateTypeDisplay } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { ToastrService } from 'ngx-toastr';
import { trigger, transition, style, animate } from '@angular/animations';
import { LoaderComponent } from '../../shared/components/loader/loader.component';
import { CommonModule } from '@angular/common';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss'],
  standalone: true,
  imports: [
    LoaderComponent,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    PaginationComponent,
    RouterModule
  ],
  animations: [
    trigger('dialogAnimation', [
      transition(':enter', [
        style({ transform: 'translate(-50%, -48%) scale(0.95)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'translate(-50%, -48%) scale(0.95)', opacity: 0 }))
      ])
    ])
  ]
})
export class ProductComponent implements OnInit {
  products: Product[] = [];
  categories: Category[] = [];
  productForm!: FormGroup;
  searchForm!: FormGroup;
  isLoading = false;
  isEditing = false;
  editingId?: number;
  
  // Pagination properties
  currentPage = 0;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];
  totalPages = 0;
  totalElements = 0;
  startIndex = 0;
  endIndex = 0;
  isDialogOpen = false;

  productTypes = [
    { value: 'NOS', label: ProductMainType.NOS },
    { value: 'REGULAR', label: ProductMainType.REGULAR },
    { value: 'POLY_CARBONATE', label: ProductMainType.POLY_CARBONATE },
    { value: 'POLY_CARBONATE_ROLL', label: ProductMainType.POLY_CARBONATE_ROLL },
    { value: 'ACCESSORIES', label: ProductMainType.ACCESSORIES }
  ];

  PolyCarbonateType = PolyCarbonateType;
  PolyCarbonateTypeDisplay = PolyCarbonateTypeDisplay;

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private fb: FormBuilder,
    private snackbarService: SnackbarService,
    private sanitizer: DomSanitizer
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  private initializeForms(): void {
    this.productForm = this.fb.group({
      name: ['', [Validators.required]],
      categoryId: ['', [Validators.required]],
      minimumStock: [0, [Validators.required, Validators.min(0)]],
      purchaseAmount: [0, [Validators.required, Validators.min(0)]],
      saleAmount: [0, [Validators.required, Validators.min(0)]],
      measurement: ['kg'],
      status: ['A'],
      weight: [0, [Validators.required, Validators.min(0)]],
      type: ['NOS'],
      description: [''],
      polyCarbonateType: [''],
      sqFeetMultiplier: [3.5], // Default value
      remainingQuantity: [0, [Validators.required]],
      blockedQuantity: [0, [Validators.required, Validators.min(0)]],
      totalRemainingQuantity: [{ value: 0, disabled: true }],
      accessoriesWeight: this.fb.group({
        size6: [0, [Validators.min(0)]],
        size8: [0, [Validators.min(0)]],
        size12: [0, [Validators.min(0)]],
        size16: [0, [Validators.min(0)]],
        size24: [0, [Validators.min(0)]],
        size32: [0, [Validators.min(0)]],
        size48: [0, [Validators.min(0)]]
      })
    });

    // Add value change subscriptions for automatic calculation
    this.productForm.get('remainingQuantity')?.valueChanges.subscribe(() => {
      this.calculateTotalRemainingQuantity();
    });

    this.productForm.get('blockedQuantity')?.valueChanges.subscribe(() => {
      this.calculateTotalRemainingQuantity();
    });

    // Add listener for type changes to show/hide sqFeetMultiplier field
    this.productForm.get('type')?.valueChanges.subscribe((type) => {
      const sqFeetMultiplierControl = this.productForm.get('sqFeetMultiplier');
      if (type === 'REGULAR') {
        // For REGULAR products, make sqFeetMultiplier available but not required
        if (sqFeetMultiplierControl) {
          sqFeetMultiplierControl.enable();
        }
      } else {
        // For non-REGULAR products, disable and reset the field
        if (sqFeetMultiplierControl) {
          sqFeetMultiplierControl.disable();
          sqFeetMultiplierControl.setValue(3.5); // Reset to default
        }
      }
    });

    // Update the name control listener
    const editableDiv = document.querySelector('.editable-content');
    if (editableDiv) {
      editableDiv.addEventListener('input', () => {
        const content = editableDiv.innerHTML;
        if (content.trim()) {
          this.productForm.patchValue({ name: content }, { emitEvent: true });
          this.productForm.get('name')?.markAsTouched();
        } else {
          this.productForm.get('name')?.setErrors({ required: true });
        }
      });
    }

    this.searchForm = this.fb.group({
      search: [''],
      categoryId: [''],
      status: ['A']
    });
  }

  loadCategories(): void {
    this.categoryService.getCategories({ status: 'A' }).subscribe({
      next: (response) => {
        this.categories = response.data;
      },
      error: () => {
        this.snackbarService.error('Failed to load categories');
      }
    });
  }

  loadProducts(): void {
    if (!this.isLoading) {
      this.isLoading = true;
    }
    
    const searchParams = {
      ...this.searchForm.value,
      size: this.pageSize,
      page: this.currentPage
    };

    this.productService.searchProducts(searchParams).subscribe({
      next: (response) => {
        this.products = response.data.content;
        this.totalPages = response.data.totalPages;
        this.totalElements = response.data.totalElements;
        this.startIndex = this.currentPage * this.pageSize;
        this.endIndex = Math.min((this.currentPage + 1) * this.pageSize, this.totalElements);
        this.isLoading = false;
      },
      error: () => {
        this.snackbarService.error('Failed to load products');
        this.isLoading = false;
      }
    });
  }

  onSubmit(): void {
    const editableDiv = document.querySelector('.editable-content') as HTMLElement;
    const productName = editableDiv?.innerHTML || '';

    if (!productName.trim()) {
      this.productForm.get('name')?.setErrors({ required: true });
      this.productForm.get('name')?.markAsTouched();
      return;
    }

    if (this.productForm.invalid) {
      Object.keys(this.productForm.controls).forEach(key => {
        const control = this.productForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
      return;
    }

    this.isLoading = true;
    const productData: any = {
      ...this.productForm.value,
      name: productName,
      polyCarbonateType: this.productForm.get('type')?.value === 'POLY_CARBONATE' 
        ? this.productForm.get('polyCarbonateType')?.value 
        : null
    };

    // For REGULAR products, ensure sqFeetMultiplier is included
    if (this.productForm.get('type')?.value === 'REGULAR') {
      // If sqFeetMultiplier is null, zero, or not set, use default 3.5
      const multiplier = this.productForm.get('sqFeetMultiplier')?.value;
      productData.sqFeetMultiplier = (multiplier && multiplier > 0) ? multiplier : 3.5;
    } else {
      // For non-REGULAR products, don't send sqFeetMultiplier
      delete productData.sqFeetMultiplier;
    }

    // Map accessories size rates only when type is ACCESSORIES
    if (this.productForm.get('type')?.value === 'ACCESSORIES') {
      const rates = this.productForm.get('accessoriesWeight')?.value || {};

      // accessoriesWeight must have numeric string keys
      productData.accessoriesWeight = {
        '6': Number(rates.size6) || 0,
        '8': Number(rates.size8) || 0,
        '12': Number(rates.size12) || 0,
        '16': Number(rates.size16) || 0,
        '24': Number(rates.size24) || 0,
        '32': Number(rates.size32) || 0,
        '48': Number(rates.size48) || 0
      };

      // accessories_size_rate must have size* keys
      productData.accessories_size_rate = {
        size6: Number(rates.size6) || 0,
        size8: Number(rates.size8) || 0,
        size12: Number(rates.size12) || 0,
        size16: Number(rates.size16) || 0,
        size24: Number(rates.size24) || 0,
        size32: Number(rates.size32) || 0,
        size48: Number(rates.size48) || 0
      };
    } else {
      productData.accessories_size_rate = null;
    }

    const request = this.isEditing
      ? this.productService.updateProduct(this.editingId!, productData)
      : this.productService.createProduct(productData);

    request.subscribe({
      next: (response) => {
        this.snackbarService.success(
          this.isEditing 
            ? 'Product updated successfully' 
            : 'Product created successfully'
        );
        // this.loadProducts();
        this.productService.refreshProducts().subscribe({
          next: (response) => {
          },
          error: (error) => {
          }
        });
        this.closeDialog();
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbarService.error(error?.error?.message);
        console.error('Error:', error);
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  editProduct(product: Product): void {
    this.isEditing = true;
    this.editingId = product.id;
    
    // Create a temporary div to decode HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = product.name;
    
    this.productForm.patchValue({
      name: product.name,
      categoryId: product.categoryId,
      description: product.description,
      minimumStock: product.minimumStock,
      purchaseAmount: product.purchaseAmount,
      saleAmount: product.saleAmount,
      measurement: product.measurement,
      status: product.status,
      weight: product.weight,
      type: product.type,
      sqFeetMultiplier: product.sqFeetMultiplier && product.sqFeetMultiplier > 0 
        ? product.sqFeetMultiplier 
        : 3.5, // Default value if null, zero, or not set
      remainingQuantity: product.remainingQuantity,
      blockedQuantity: product.blockedQuantity,
      totalRemainingQuantity: product.totalRemainingQuantity,
      ...( product?.polyCarbonateType ? {polyCarbonateType: product.polyCarbonateType} : {})
    });

    // Handle field enabling/disabling based on product type
    /*const sqFeetMultiplierControl = this.productForm.get('sqFeetMultiplier');
    if (product.type === ProductMainType.REGULAR) {
      if (sqFeetMultiplierControl) {
        sqFeetMultiplierControl.enable();
      }
    } else {
      if (sqFeetMultiplierControl) {
        sqFeetMultiplierControl.disable();
      }
    }*/

    // Populate accessories rates if present (prefer new accessoriesWeight from API, fallback to legacy accessories_size_rate)
    const accessories = (product as any)?.accessoriesWeight || (product as any)?.accessories_size_rate || null;
    if (accessories) {
      this.productForm.get('accessoriesWeight')?.patchValue({
        size6: accessories['6'] ?? accessories['size6'] ?? 0,
        size8: accessories['8'] ?? accessories['size8'] ?? 0,
        size12: accessories['12'] ?? accessories['size12'] ?? 0,
        size16: accessories['16'] ?? accessories['size16'] ?? 0,
        size24: accessories['24'] ?? accessories['size24'] ?? 0,
        size32: accessories['32'] ?? accessories['size32'] ?? 0,
        size48: accessories['48'] ?? accessories['size48'] ?? 0
      });
    } else {
      this.productForm.get('accessoriesWeight')?.reset({
        size6: 0, size8: 0, size12: 0, size16: 0, size24: 0, size32: 0, size48: 0
      });
    }

    // Calculate total remaining quantity after setting values
    this.calculateTotalRemainingQuantity();

    // Set the content after a short delay to ensure the contenteditable is ready
    setTimeout(() => {
      const editableDiv = document.querySelector('.editable-content') as HTMLElement;
      if (editableDiv) {
        editableDiv.innerHTML = product.name || '';
      }
    }, 0);

    this.isDialogOpen = true;
  }

  deleteProduct(id: number): void {
    if (confirm('Are you sure you want to delete this product?')) {
      this.isLoading = true;
      this.productService.deleteProduct(id).subscribe({
        next: () => {
          this.snackbarService.success('Product deleted successfully');
          this.productService.refreshProducts().subscribe({
            next: (response) => {
            },
            error: (error) => {
            }
          });
          this.loadProducts();
          // this.isLoading = false;
        },
        error: (error) => {
          this.snackbarService.error(error?.error?.message || 'Failed to delete product');
          this.isLoading = false;
        }
      });
    }
  }

  resetForm(): void {
    this.isEditing = false;
    this.editingId = undefined;
    this.productForm.reset({ status: 'A',
      purchaseAmount: 0,
      saleAmount: 0,
      measurement: 'kg',
      weight: 0,
      type: ProductMainType.NOS,
      sqFeetMultiplier: 3.5 // Default value
    });
    
    // Ensure sqFeetMultiplier is disabled for non-REGULAR products by default
    const sqFeetMultiplierControl = this.productForm.get('sqFeetMultiplier');
    if (sqFeetMultiplierControl) {
      sqFeetMultiplierControl.disable();
    }
  }

  onSearch(): void {
    this.currentPage = 0;
    this.isLoading = true;
    this.loadProducts();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadProducts();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 0;
    this.loadProducts();
  }

  openCreateDialog(): void {
    this.isEditing = false;
    this.editingId = undefined;
    this.productForm.reset({
      status: 'A',
      type: 'NOS',
      minimumStock: 0,
      purchaseAmount: 0,
      saleAmount: 0,
      measurement: 'kg',
      weight: 0,
      sqFeetMultiplier: 3.5, // Default value
      remainingQuantity: 0,
      blockedQuantity: 0
    });
    
    // Ensure sqFeetMultiplier is disabled for non-REGULAR products by default
    const sqFeetMultiplierControl = this.productForm.get('sqFeetMultiplier');
    if (sqFeetMultiplierControl) {
      sqFeetMultiplierControl.disable();
    }
    
    this.productForm.get('accessoriesWeight')?.reset({
      size6: 0, size8: 0, size12: 0, size16: 0, size24: 0, size32: 0, size48: 0
    });
    
    // Calculate initial total remaining quantity
    this.calculateTotalRemainingQuantity();
    
    this.isDialogOpen = true;
    setTimeout(() => {
      const editableDiv = document.querySelector('.editable-content') as HTMLElement;
      if (editableDiv) {
        editableDiv.innerHTML = '';
        editableDiv.focus();
        // Reinitialize the input listener
        editableDiv.addEventListener('input', () => {
          const content = editableDiv.innerHTML;
          if (content.trim()) {
            this.productForm.patchValue({ name: content }, { emitEvent: true });
            this.productForm.get('name')?.markAsTouched();
          } else {
            this.productForm.get('name')?.setErrors({ required: true });
          }
        });
      }
    });
  }

  closeDialog(): void {
    if (!this.productForm.dirty) {
      this.isLoading = false;
    }
    this.isDialogOpen = false;
    this.resetForm();
    this.loadProducts();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  toggleBold(): void {
    document.execCommand('bold', false);
    const editableDiv = document.querySelector('.editable-content') as HTMLElement;
    if (editableDiv) {
      const content = editableDiv.innerHTML;
      if (content.trim()) {
        this.productForm.patchValue({ name: content }, { emitEvent: true });
        this.productForm.get('name')?.markAsTouched();
      } else {
        this.productForm.get('name')?.setErrors({ required: true });
      }
    }
  }

  validateRemainingQuantity() {
    const remainingQuantity = this.productForm.get('remainingQuantity')?.value;
    const blockedAmount = this.productForm.get('blockedQuantity')?.value;

    // if (remainingQuantity < blockedAmount) {
    //   this.productForm.get('remainingQuantity')?.setErrors({ invalid: true });
    // } else {
    //   this.productForm.get('remainingQuantity')?.setErrors(null);
    // }
  }

  exportProducts(): void {
    const searchParams = { ...this.searchForm.value };
    delete searchParams.pageSize;
    delete searchParams.currentPage;

    this.productService.exportProducts(searchParams).subscribe({
      next: (response: Blob) => {
        const blob = new Blob([response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'products.pdf';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        this.snackbarService.error('Failed to export products');
      }
    });
  }

  // Add new method for calculation
  private calculateTotalRemainingQuantity(): void {
    const remainingQuantity = this.productForm.get('remainingQuantity')?.value ?? 0;
    const blockedQuantity = this.productForm.get('blockedQuantity')?.value ?? 0;
    const totalRemaining = remainingQuantity - blockedQuantity;
    
    this.productForm.patchValue({
      totalRemainingQuantity: totalRemaining
    }, { emitEvent: false });
  }
}