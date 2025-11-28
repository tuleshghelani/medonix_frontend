import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-packaging-charges-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="modal-overlay" *ngIf="show" (click)="onCancel()">
      <div class="modal-content" (click)="$event.stopPropagation()" [@modalAnimation]>
        <div class="modal-header">
          <h3><i class="fas fa-box"></i> Packaging & Forwarding Charges</h3>
        </div>
        <form [formGroup]="chargesForm" (ngSubmit)="onSubmit()">
          <div class="modal-body">
            <div class="form-group">
              <label for="packagingAndForwadingCharges">
                <i class="fas fa-rupee-sign"></i> Packaging & Forwarding Charges <span class="required">*</span>
              </label>
              <input 
                type="number" 
                id="packagingAndForwadingCharges" 
                formControlName="packagingAndForwadingCharges" 
                class="form-control"
                min="0"
                step="0.01"
                placeholder="Enter packaging and forwarding charges"
                [class.is-invalid]="chargesForm.get('packagingAndForwadingCharges')?.invalid && chargesForm.get('packagingAndForwadingCharges')?.touched"
              >
              <div class="invalid-feedback" *ngIf="chargesForm.get('packagingAndForwadingCharges')?.errors?.['required']">
                Packaging and forwarding charges is required
              </div>
              <div class="invalid-feedback" *ngIf="chargesForm.get('packagingAndForwadingCharges')?.errors?.['min']">
                Charges must be 0 or greater
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="onCancel()">
              <i class="fas fa-times"></i> Cancel
            </button>
            <button type="submit" class="btn btn-primary" [disabled]="chargesForm.invalid || isLoading">
              <i class="fas" [ngClass]="isLoading ? 'fa-spinner fa-spin' : 'fa-check'"></i>
              {{ isLoading ? 'Creating...' : 'Create Sale' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styleUrls: ['./packaging-charges-modal.component.scss'],
  animations: [
    trigger('modalAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-20px)' }))
      ])
    ])
  ]
})
export class PackagingChargesModalComponent implements OnChanges {
  @Input() show = false;
  @Input() defaultCharges: number = 0;
  @Output() confirm = new EventEmitter<number>();
  @Output() cancel = new EventEmitter<void>();

  chargesForm: FormGroup;
  isLoading = false;

  constructor(private fb: FormBuilder) {
    this.chargesForm = this.fb.group({
      packagingAndForwadingCharges: [
        0,
        [Validators.required, Validators.min(0)]
      ]
    });
  }

  ngOnChanges(): void {
    if (this.show && this.defaultCharges !== undefined) {
      this.chargesForm.patchValue({
        packagingAndForwadingCharges: this.defaultCharges || 0
      });
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onSubmit(): void {
    if (this.chargesForm.valid) {
      const charges = Number(this.chargesForm.get('packagingAndForwadingCharges')?.value || 0);
      this.confirm.emit(charges);
    } else {
      this.chargesForm.markAllAsTouched();
    }
  }
}
