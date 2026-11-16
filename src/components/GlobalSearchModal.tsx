import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CreditCard,
  FileHeart,
  Landmark,
  Receipt,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useSavern } from '../context/SavernContext.tsx';
import { activeRecords, formatCurrency, formatDateDisplay } from '../lib/financeEngine.ts';
import { Modal } from './ui/Modal.tsx';

type FilterScope = 'all' | 'transactions' | 'accounts' | 'goals' | 'loans' | 'medical' | 'investments';

export const GlobalSearchModal: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, data } = useSavern();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<FilterScope>('all');

  const prefs = data.userPreferences;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Array<{
      id: string;
      scope: FilterScope;
      title: string;
      subtitle: string;
      amount?: string;
      route: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = [];

    if (scope === 'all' || scope === 'transactions') {
      for (const tx of activeRecords(data.transactions)) {
        if (
          !q ||
          tx.description.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.paymentMethod.toLowerCase().includes(q)
        ) {
          list.push({
            id: `tx_${tx.id}`,
            scope: 'transactions',
            title: tx.description,
            subtitle: `Transaction · ${tx.category} · ${formatDateDisplay(tx.date, prefs.dateFormat)}`,
            amount: formatCurrency(tx.amount, prefs.currency, prefs.numberFormat, prefs.hideAmounts),
            route: '/transactions',
            icon: Receipt,
          });
        }
      }
    }

    if (scope === 'all' || scope === 'accounts') {
      for (const acc of activeRecords(data.accounts)) {
        if (!q || acc.name.toLowerCase().includes(q) || acc.type.toLowerCase().includes(q)) {
          list.push({
            id: `acc_${acc.id}`,
            scope: 'accounts',
            title: acc.name,
            subtitle: `Account · ${acc.type.toUpperCase()}`,
            route: '/accounts',
            icon: Landmark,
          });
        }
      }
    }

    if (scope === 'all' || scope === 'goals') {
      for (const g of activeRecords(data.savingsGoals)) {
        if (!q || g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)) {
          list.push({
            id: `goal_${g.id}`,
            scope: 'goals',
            title: g.name,
            subtitle: `Savings Goal · ${g.category}`,
            amount: formatCurrency(g.targetAmount, prefs.currency, prefs.numberFormat, prefs.hideAmounts),
            route: '/goals',
            icon: Target,
          });
        }
      }
    }

    if (scope === 'all' || scope === 'loans') {
      for (const l of activeRecords(data.loans)) {
        if (!q || l.title.toLowerCase().includes(q) || l.counterpartyName.toLowerCase().includes(q)) {
          list.push({
            id: `loan_${l.id}`,
            scope: 'loans',
            title: l.title,
            subtitle: `Loan (${l.direction}) · ${l.counterpartyName}`,
            amount: formatCurrency(l.principalAmount, prefs.currency, prefs.numberFormat, prefs.hideAmounts),
            route: '/loans',
            icon: CreditCard,
          });
        }
      }
      for (const emi of activeRecords(data.emiPlans)) {
        if (!q || emi.loanName.toLowerCase().includes(q) || emi.lender.toLowerCase().includes(q)) {
          list.push({
            id: `emi_${emi.id}`,
            scope: 'loans',
            title: emi.loanName,
            subtitle: `EMI Plan · ${emi.lender}`,
            amount: `${formatCurrency(emi.emiAmount, prefs.currency, prefs.numberFormat, prefs.hideAmounts)}/mo`,
            route: '/loans',
            icon: CreditCard,
          });
        }
      }
    }

    if (scope === 'all' || scope === 'medical') {
      for (const claim of activeRecords(data.medicalClaims)) {
        if (!q || claim.title.toLowerCase().includes(q) || claim.hospital.toLowerCase().includes(q)) {
          list.push({
            id: `claim_${claim.id}`,
            scope: 'medical',
            title: claim.title,
            subtitle: `Medical Claim · ${claim.hospital}`,
            amount: formatCurrency(claim.amountClaimed, prefs.currency, prefs.numberFormat, prefs.hideAmounts),
            route: '/medical',
            icon: FileHeart,
          });
        }
      }
    }

    if (scope === 'all' || scope === 'investments') {
      for (const inv of activeRecords(data.investments)) {
        if (!q || inv.fundName.toLowerCase().includes(q) || inv.amc.toLowerCase().includes(q)) {
          list.push({
            id: `inv_${inv.id}`,
            scope: 'investments',
            title: inv.fundName,
            subtitle: `Mutual Fund · ${inv.amc}`,
            amount: formatCurrency(inv.investedAmount, prefs.currency, prefs.numberFormat, prefs.hideAmounts),
            route: '/investments',
            icon: TrendingUp,
          });
        }
      }
    }

    return list.slice(0, 24);
  }, [query, scope, data, prefs]);

  return (
    <Modal
      open={isSearchOpen}
      onClose={() => setIsSearchOpen(false)}
      title="Global Financial Search"
      subtitle="Search across transactions, accounts, goals, loans, EMIs, claims, and investments"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, category, institution, hospital, or fund..."
            className="w-full rounded-lg border border-[#273449] bg-[#101827] py-2.5 pl-10 pr-4 text-sm text-[#F5F7FA] focus:border-[#24D6A0] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'All'],
              ['transactions', 'Transactions'],
              ['accounts', 'Accounts'],
              ['goals', 'Goals'],
              ['loans', 'Loans & EMI'],
              ['medical', 'Medical Claims'],
              ['investments', 'Investments'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setScope(val)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                scope === val
                  ? 'bg-[#24D6A0]/15 text-[#24D6A0] border border-[#24D6A0]/40'
                  : 'bg-[#101827] text-[#94A3B8] border border-[#273449] hover:text-[#F5F7FA]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-[#273449] rounded-xl border border-[#273449] bg-[#101827] max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#94A3B8]">
              No matching records found for "{query}".
            </div>
          ) : (
            results.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigate(item.route);
                    setIsSearchOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1B2940]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#273449] bg-[#151F30] text-[#39A0ED]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#F5F7FA]">{item.title}</p>
                      <p className="truncate text-xs text-[#94A3B8]">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.amount && (
                      <span className="text-sm font-semibold text-[#F5F7FA] font-mono-num">
                        {item.amount}
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-[#94A3B8]" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
