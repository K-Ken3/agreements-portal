import Image from "next/image";

export function BrandLogo() {
  return (
    <Image
      className="brand-logo"
      src="/agreeit-logo.png"
      alt="AgreeIt"
      width={1455}
      height={401}
    />
  );
}
