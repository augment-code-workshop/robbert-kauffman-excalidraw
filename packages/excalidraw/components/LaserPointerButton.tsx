import clsx from "clsx";

import { IconButton } from "./IconButton";
import { laserPointerToolIcon, PenModeIcon } from "./icons";

type LaserPointerButtonProps = {
  title?: string;
  checked: boolean;
  onChange?(): void;
  isMobile?: boolean;
};

const PresentationToolButton = ({
  icon,
  testId,
  className,
  ...props
}: LaserPointerButtonProps & {
  icon: React.ReactNode;
  testId: string;
  className: string;
}) => (
  <IconButton
    className={clsx(className, { "is-mobile": props.isMobile })}
    type="toggle"
    size="small"
    icon={icon}
    checked={props.checked}
    title={`${props.title}`}
    aria-label={`${props.title}`}
    data-testid={testId}
    onSelect={() => props.onChange?.()}
  />
);

export const LaserPointerButton = (props: LaserPointerButtonProps) => (
  <PresentationToolButton
    {...props}
    className="ToolIcon__LaserPointer"
    icon={laserPointerToolIcon}
    testId="toolbar-LaserPointer"
  />
);

export const AnnotationButton = (props: LaserPointerButtonProps) => (
  <PresentationToolButton
    {...props}
    className="ToolIcon__Annotation"
    icon={PenModeIcon}
    testId="toolbar-annotation-collab"
  />
);
