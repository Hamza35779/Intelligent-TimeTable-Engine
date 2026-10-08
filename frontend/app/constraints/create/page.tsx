'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConstraints } from '../../../hooks/useConstraints';
import ConstraintForm from '../../../components/ConstraintForm';
import { ArrowLeft } from 'lucide-react';

export default function CreateConstraintPage() {
  const router = useRouter();
  const { createConstraint } = useConstraints();

  const handleCreate = async (data: any) => {
    const success = await createConstraint(data);
    if (success) {
      router.push('/constraints');
      return true;
    }
    return false;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href="/constraints"
        className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Constraints</span>
      </Link>

      <ConstraintForm
        onSubmit={handleCreate}
        onCancel={() => router.push('/constraints')}
      />
    </div>
  );
}
