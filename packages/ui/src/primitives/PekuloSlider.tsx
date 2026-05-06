"use client";

import { Slider as TamaSlider, type SliderProps } from "@tamagui/slider";
import type { ComponentProps } from "react";

function Root(props: SliderProps) {
  return <TamaSlider {...props} />;
}

function Track(props: ComponentProps<typeof TamaSlider.Track>) {
  return <TamaSlider.Track backgroundColor="$backgroundMuted" height={4} {...props} />;
}

function TrackActive(props: ComponentProps<typeof TamaSlider.TrackActive>) {
  return <TamaSlider.TrackActive backgroundColor="$accent" {...props} />;
}

function Thumb(props: ComponentProps<typeof TamaSlider.Thumb>) {
  return (
    <TamaSlider.Thumb
      backgroundColor="$color"
      borderWidth={0}
      size={16}
      circular
      focusVisibleStyle={{
        outlineColor: "$borderFocus",
        outlineStyle: "solid",
        outlineWidth: 2,
        outlineOffset: 2,
      }}
      {...props}
    />
  );
}

export const PekuloSlider = Object.assign(Root, { Track, TrackActive, Thumb });
