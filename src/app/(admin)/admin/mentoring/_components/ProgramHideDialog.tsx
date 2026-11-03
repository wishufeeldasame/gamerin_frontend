'use client';

import { MentoringReasonDialog, type MentoringReasonDialogProps } from './MentoringReasonDialog';

type ProgramHideDialogProps = Omit<MentoringReasonDialogProps, 'action' | 'targetName'> & { programTitle: string };

export function ProgramHideDialog({ programTitle, ...props }: ProgramHideDialogProps) {
  return <MentoringReasonDialog targetName={programTitle} action="hide" {...props} />;
}
