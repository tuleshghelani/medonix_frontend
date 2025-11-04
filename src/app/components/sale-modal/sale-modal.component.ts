import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Purchase } from '../../models/purchase.model';
import { SaleService } from '../../services/sale.service';
import { ToastrService } from 'ngx-toastr';
import { ModalService } from '../../services/modal.service';
import { map } from 'rxjs/operators';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { Sale } from '../../models/sale.model';

interface DiscountCalculation {
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
}

@Component({
  selector: 'app-sale-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sale-modal.component.html',
  styleUrls: ['./sale-modal.component.scss']
})
export class SaleModalComponent implements OnChanges {
  @Input() purchase!: Purchase;
  @Input() sales!: Sale;
  @Output() saleCreated = new EventEmitter<boolean>();
  
  saleForm!: FormGroup;
  loading = false;
  display$ = this.modalService.modalState$.pipe(
    map(state => state.isOpen)
  );

  constructor(
    private fb: FormBuilder,
    private saleService: SaleService,
    private snackbar: SnackbarService,
    private modalService: ModalService
  ) {
    this.initForm();
  }

  private initForm() {
    const now = new Date();
    const localISOString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      .toISOString()
      .slice(0, 16);

    this.saleForm = this.fb.group({
      purchaseId: ['', Validators.required],
      quantity: ['', [Validators.required, Validators.min(1)]],
      unitPrice: ['', [Validators.required, Validators.min(0.01)]],
      saleDate: [localISOString],
      invoiceNumber: ['', Validators.required],
      otherExpenses: [0, [Validators.min(0)]],
      discount: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      discountAmount: [0, [Validators.required, Validators.min(0)]],
      discountedPrice: [{ value: 0, disabled: true }]
    });

    this.setupDiscountCalculation();
  }

  private setupDiscountCalculation() {
    const fields = ['quantity', 'unitPrice', 'discount', 'discountAmount'];
    fields.forEach(field => {
      this.saleForm.get(field)?.valueChanges.subscribe(() => {
        this.calculateDiscount();
      });
    });
  }

  private calculateDiscount(): void {
    const values = {
      quantity: this.saleForm.get('quantity')?.value || 0,
      unitPrice: this.saleForm.get('unitPrice')?.value || 0,
      discountPercentage: this.saleForm.get('discount')?.value || 0,
      discountAmount: this.saleForm.get('discountAmount')?.value || 0,
      finalPrice: 0
    };

    const totalPrice = values.quantity * values.unitPrice;
    
    if (values.discountAmount > 0) {
      values.finalPrice = totalPrice - values.discountAmount;
      values.discountPercentage = (values.discountAmount / totalPrice) * 100;
    } else if (values.discountPercentage > 0) {
      values.discountAmount = (totalPrice * values.discountPercentage) / 100;
      values.finalPrice = totalPrice - values.discountAmount;
    } else {
      values.finalPrice = totalPrice;
    }

    this.saleForm.patchValue({
      discountAmount: values.discountAmount,
      discount: values.discountPercentage,
      discountedPrice: values.finalPrice
    }, { emitEvent: false });
  }

  setupForm(purchase: Purchase) {
    // Get current date in local timezone
    const now = new Date();
    const localISOString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      .toISOString()
      .slice(0, 16);

    this.saleForm.patchValue({
      purchaseId: purchase.id,
      unitPrice: purchase.unitPrice,
      quantity: '',
      invoiceNumber: '',
      otherExpenses: 0,
    });
    
    console.log('Form values after patch:', this.saleForm.value);
    
    this.saleForm.get('quantity')?.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(purchase.remainingQuantity ?? 0)
    ]);
  }

  onSubmit() {
    if (this.saleForm.valid) {
      this.loading = true;
      const formData = { ...this.saleForm.value };
      
      // Add check for purchaseId
      if (!formData.purchaseId) {
        this.snackbar.error('Purchase ID is missing');
        this.loading = false;
        return;
      }

      // Handle sale date formatting
      try {
        if (formData.saleDate) {
          // First ensure we have a valid date object
          const date = new Date(formData.saleDate);
          
          // Check if date is valid
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
          }

          // Format date in a consistent way
          formData.saleDate = date.toLocaleString('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).replace(/\//g, '-').replace(',', '');
        } else {
          // If no date provided, use current date-time
          const now = new Date();
          formData.saleDate = now.toLocaleString('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).replace(/\//g, '-').replace(',', '');
        }

        console.log('Sale form data being sent:', formData);

        this.saleService.createSale(formData).subscribe({
          next: (response) => {
            this.snackbar.success('Sale created successfully');
            this.saleCreated.emit(true);
            this.loading = false;
            this.close();
          },
          error: (error) => {
            this.loading = false;
            this.snackbar.error(error?.error?.message || 'Failed to create sale');
          }
        });

      } catch (error) {
        this.loading = false;
        this.snackbar.error('Invalid date format');
        return;
      }
    }
  }

  close() {
    this.modalService.close();
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['purchase'] && changes['purchase'].currentValue) {
      this.setupForm(changes['purchase'].currentValue);
    }
  }
} 