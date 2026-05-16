import { BadRequestException, Injectable } from '@nestjs/common';

import { CalculateBillTotalDto } from './dto/calculate-bill-total.dto';

const DEFAULT_VAT_RATE = 13;

@Injectable()
export class BillingTotalService {
  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  calculateTotals(payload: CalculateBillTotalDto) {
    const vatRate = payload.vatRate ?? DEFAULT_VAT_RATE;
    const discountAmount = payload.discountAmount ?? 0;

    const billableItems = payload.items.filter((item) => !item.voided);

    if (billableItems.length === 0) {
      throw new BadRequestException('At least one billable item is required.');
    }

    const itemLines = billableItems.map((item) => {
      const grossAmount = this.roundMoney(item.qty * item.rate);

      return {
        id: item.id,
        name: item.name,
        qty: item.qty,
        rate: item.rate,
        grossAmount,
      };
    });

    const grossTotal = this.roundMoney(
      itemLines.reduce((sum, item) => sum + item.grossAmount, 0),
    );

    if (discountAmount > grossTotal) {
      throw new BadRequestException('Discount cannot exceed gross total.');
    }

    const discountedGrossTotal = this.roundMoney(grossTotal - discountAmount);
    const vatDivisor = 1 + vatRate / 100;

    /**
     * Current Softzeno POS rule:
     * Item prices are VAT-inclusive.
     *
     * Example:
     * Rs. 113 at 13% VAT means:
     * taxableSubtotal = 100
     * vatAmount = 13
     * grandTotal = 113
     */
    const taxableSubtotal = this.roundMoney(discountedGrossTotal / vatDivisor);
    const vatAmount = this.roundMoney(discountedGrossTotal - taxableSubtotal);
    const grandTotal = discountedGrossTotal;

    return {
      vatMode: 'VAT_INCLUDED',
      vatRate,
      grossTotal,
      discountAmount: this.roundMoney(discountAmount),
      taxableSubtotal,
      vatAmount,
      grandTotal,
      itemLines,
    };
  }
}
