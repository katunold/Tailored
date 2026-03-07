import { Component, inject, InjectionToken } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirm-dialog.component.html'
})
export class ConfirmDialogComponent {
  readonly data = inject(
    MAT_DIALOG_DATA as unknown as InjectionToken<ConfirmDialogData>
  );
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}
