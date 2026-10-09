import { Modal, type ModalProps } from "./modal";

export type BottomSheetProps = Omit<ModalProps, "variant" | "maxWidth">;

export function BottomSheet(props: BottomSheetProps) {
  return <Modal {...props} variant="sheet" maxWidth="576px" />;
}
