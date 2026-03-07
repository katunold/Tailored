import { AbstractControl, ValidationErrors } from '@angular/forms';

export function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (!value) {
    return null;
  }

  if (!/^\+?[0-9]{10,15}$/.test(value)) {
    return { phone: true };
  }

  return null;
}
