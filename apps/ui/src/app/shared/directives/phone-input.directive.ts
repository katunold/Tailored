import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
  selector: 'input[appPhoneInput]',
  standalone: true
})
export class PhoneInputDirective {
  private readonly elementRef = inject(ElementRef<HTMLInputElement>);

  @HostListener('input')
  onInput(): void {
    const input = this.elementRef.nativeElement;
    const current = input.value;
    const normalized = this.normalizePhoneInput(current);

    if (normalized !== current) {
      input.value = normalized;
    }
  }

  private normalizePhoneInput(value: string): string {
    const hasLeadingPlus = value.startsWith('+');
    const digits = value.replace(/\D/g, '').slice(0, 15);
    if (!digits) {
      return hasLeadingPlus ? '+' : '';
    }

    return hasLeadingPlus ? `+${digits}` : digits;
  }
}
