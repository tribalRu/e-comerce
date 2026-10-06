"use client";

// Оформление заказа: форма с валидацией + экран успеха с номером заказа

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Banknote, CheckCircle2, CreditCard, Loader2, Store, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FREE_DELIVERY_FROM, formatPrice } from "./utils";
import type { CartApi } from "./use-cart";
import type { OrderInfo } from "./types";

type Delivery = "courier" | "pickup";
type Payment = "card" | "cash";

interface CheckoutDialogProps {
  cart: CartApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  comment: string;
}

const EMPTY_FORM: FormState = { name: "", phone: "", email: "", address: "", comment: "" };
const DELIVERY_FEE = 299;

export function CheckoutDialog({ cart, open, onOpenChange }: CheckoutDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [delivery, setDelivery] = useState<Delivery>("courier");
  const [payment, setPayment] = useState<Payment>("card");
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<(OrderInfo & { deliveryFee: number }) | null>(null);

  useEffect(() => {
    if (open) {
      setOrder(null);
      setErrors({});
    }
  }, [open]);

  const deliveryFee = delivery === "courier" && cart.subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
  const total = cart.subtotal + deliveryFee;

  const set =
    (key: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.name.trim().length < 2) next.name = "Введите имя (минимум 2 символа)";
    if (form.phone.replace(/\D/g, "").length < 7) next.phone = "Введите корректный телефон";
    if (delivery === "courier" && form.address.trim().length < 5) next.address = "Укажите адрес доставки";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          delivery,
          payment,
          comment: form.comment.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { order: OrderInfo };
        setOrder({ ...data.order, deliveryFee });
        setForm(EMPTY_FORM);
        void cart.refresh();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast({
          title: "Не удалось оформить заказ",
          description: data?.error ?? "Проверьте данные и попробуйте ещё раз",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Сеть недоступна",
        description: "Не удалось отправить заказ. Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="thin-scrollbar max-h-[92vh] max-w-lg overflow-y-auto sm:rounded-2xl">
        {order ? (
          <SuccessView order={order} onClose={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} noValidate>
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-extrabold text-gray-900">Оформление заказа</DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                Заполните данные — мы перезвоним для подтверждения
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              <Field label="Имя и фамилия" required error={errors.name}>
                <Input
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Мария Иванова"
                  autoComplete="name"
                  className="h-11"
                />
              </Field>

              <Field label="Телефон" required error={errors.phone}>
                <Input
                  value={form.phone}
                  onChange={set("phone")}
                  type="tel"
                  placeholder="+7 (999) 123-45-67"
                  autoComplete="tel"
                  className="h-11"
                />
              </Field>

              <Field label="Email" hint="Необязательно — пришлём статус заказа">
                <Input
                  value={form.email}
                  onChange={set("email")}
                  type="email"
                  placeholder="maria@example.ru"
                  autoComplete="email"
                  className="h-11"
                />
              </Field>

              <fieldset>
                <legend className="text-sm font-semibold text-gray-900">Способ получения</legend>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <RadioCard
                    active={delivery === "courier"}
                    onClick={() => setDelivery("courier")}
                    icon={Truck}
                    title="Курьером"
                    subtitle="2–4 дня"
                  />
                  <RadioCard
                    active={delivery === "pickup"}
                    onClick={() => setDelivery("pickup")}
                    icon={Store}
                    title="Самовывоз"
                    subtitle="Со следующего дня"
                  />
                </div>
              </fieldset>

              {delivery === "courier" && (
                <Field label="Адрес доставки" required error={errors.address}>
                  <Textarea
                    value={form.address}
                    onChange={set("address")}
                    placeholder="Город, улица, дом, квартира"
                    rows={2}
                    className="resize-none"
                  />
                </Field>
              )}

              <fieldset>
                <legend className="text-sm font-semibold text-gray-900">Оплата</legend>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <RadioCard
                    active={payment === "card"}
                    onClick={() => setPayment("card")}
                    icon={CreditCard}
                    title="Картой онлайн"
                    subtitle="Visa, Mastercard, Мир"
                  />
                  <RadioCard
                    active={payment === "cash"}
                    onClick={() => setPayment("cash")}
                    icon={Banknote}
                    title="При получении"
                    subtitle="Наличными или картой"
                  />
                </div>
              </fieldset>

              <Field label="Комментарий" hint="Необязательно">
                <Textarea
                  value={form.comment}
                  onChange={set("comment")}
                  placeholder="Например, позвонить после 18:00"
                  rows={2}
                  className="resize-none"
                />
              </Field>

              <div className="rounded-xl bg-[#F7F7F7] p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Товары ({cart.count})</span>
                  <span className="font-semibold text-gray-900">{formatPrice(cart.subtotal)}</span>
                </div>
                <div className="mt-1.5 flex justify-between">
                  <span className="text-gray-600">Доставка</span>
                  <span className={cn("font-semibold", deliveryFee === 0 ? "text-emerald-600" : "text-gray-900")}>
                    {deliveryFee === 0 ? "Бесплатно" : formatPrice(deliveryFee)}
                  </span>
                </div>
                <div className="mt-2.5 flex justify-between border-t border-gray-200 pt-2.5 text-base font-extrabold text-gray-900">
                  <span>Итого</span>
                  <span className="tabular-nums">{formatPrice(total)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || cart.items.length === 0}
                className="h-12 w-full rounded-full bg-[#CC0000] text-sm font-bold text-white transition-colors hover:bg-[#A80000] disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="mx-auto size-5 animate-spin" aria-label="Оформляем заказ" />
                ) : (
                  `Подтвердить заказ · ${formatPrice(total)}`
                )}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  required,
  error,
  hint,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block">
        <span className="text-sm font-semibold text-gray-900">
          {label}
          {required ? (
            <span className="ml-0.5 text-[#CC0000]" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 block">{children}</span>
        {hint && !error ? <span className="mt-1 block text-xs text-gray-400">{hint}</span> : null}
      </label>
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RadioCard({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        active ? "border-[#CC0000] bg-[#FFF6F6] ring-1 ring-[#CC0000]" : "border-gray-200 hover:border-gray-300",
      )}
    >
      <Icon className={cn("size-5 shrink-0", active ? "text-[#CC0000]" : "text-gray-400")} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-gray-900">{title}</span>
        <span className="block truncate text-xs text-gray-500">{subtitle}</span>
      </span>
    </button>
  );
}

function SuccessView({ order, onClose }: { order: OrderInfo & { deliveryFee: number }; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="size-9" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-xl font-extrabold text-gray-900">Заказ оформлен!</h3>
      <p className="mt-1.5 max-w-[320px] text-sm text-gray-600">
        Номер заказа — <span className="font-bold text-gray-900">{order.number}</span>. Мы позвоним, чтобы
        подтвердить его.
      </p>
      <div className="mt-5 w-full rounded-xl bg-[#F7F7F7] p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Товаров</span>
          <span className="font-semibold text-gray-900">{order.itemsCount} шт.</span>
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className="text-gray-600">Доставка</span>
          <span className={cn("font-semibold", order.deliveryFee === 0 ? "text-emerald-600" : "text-gray-900")}>
            {order.deliveryFee === 0 ? "Бесплатно" : formatPrice(order.deliveryFee)}
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base font-extrabold text-gray-900">
          <span>Итого</span>
          <span className="tabular-nums">{formatPrice(order.total + order.deliveryFee)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 h-11 w-full rounded-full bg-[#CC0000] text-sm font-bold text-white transition-colors hover:bg-[#A80000]"
      >
        Отлично!
      </button>
    </div>
  );
}
