export interface TutorialTask {
  id: string;
  title: string;
  description?: string;
  completed?: boolean;
  optional?: boolean;
}

export interface XRTutorialOptions {
  title?: string;
  tasks: TutorialTask[];
  autoSound?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onTaskComplete?: (task: TutorialTask, remaining: number) => void;
  onAllComplete?: () => void;
}
