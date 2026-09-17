import { DEFAULT_LASER_COLOR, easeOut } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import { AnimatedTrail } from "./animatedTrail";
import { getClientColor } from "./clients";

import type { Trail } from "./animatedTrail";
import type App from "./components/App";
import type { SocketId } from "./types";

export class LaserTrails implements Trail {
  public localTrail: AnimatedTrail;
  private collabTrails = new Map<SocketId, AnimatedTrail>();
  private container?: SVGSVGElement;

  constructor(private app: App) {
    this.localTrail = new AnimatedTrail(app, {
      ...this.getTrailOptions(),
      fill: () => DEFAULT_LASER_COLOR,
    });
  }

  private getTrailOptions() {
    return {
      simplify: 0,
      streamline: 0.4,
      sizeMapping: (c) => {
        const DECAY_TIME = 1000;
        const DECAY_LENGTH = 50;
        const t = Math.max(
          0,
          1 - (performance.now() - c.pressure) / DECAY_TIME,
        );
        const l =
          (DECAY_LENGTH -
            Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
          DECAY_LENGTH;

        return Math.min(easeOut(l), easeOut(t));
      },
    } as Partial<LaserPointerOptions>;
  }

  startPath(x: number, y: number): void {
    this.localTrail.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    this.localTrail.addPointToPath(x, y);
  }

  endPath(): void {
    this.localTrail.endPath();
  }

  cancelPath(): void {
    this.localTrail.cancelPath();
  }

  start(container: SVGSVGElement) {
    this.container = container;
    this.localTrail.start(container);
  }

  stop() {
    this.localTrail.stop();
    this.stopCollabTrails();
    this.container = undefined;
  }

  private stopCollabTrails(collaborators?: App["state"]["collaborators"]) {
    for (const [key, trail] of this.collabTrails) {
      const collaborator = collaborators?.get(key);

      if (!collaborator) {
        trail.stop();
        this.collabTrails.delete(key);
      }
    }
  }

  updateCollabTrails(collaborators: App["state"]["collaborators"]) {
    this.stopCollabTrails(collaborators);

    if (!this.container || collaborators.size === 0) {
      return;
    }

    for (const [key, collaborator] of collaborators.entries()) {
      // Current user has their own trail drawn via localTrail
      if (collaborator.isCurrentUser) {
        continue;
      }

      // IDEA: Use the collaborator pointer coordinates to trace out the
      // laser pointer trail when 1) the selected collab tool is the laser
      // pointer and 2) the collab pointer button is in the "down" state.
      let trail = this.collabTrails.get(key);
      if (!trail) {
        trail = new AnimatedTrail(this.app, {
          ...this.getTrailOptions(),
          fill: () =>
            collaborator.pointer?.laserColor ||
            getClientColor(key, collaborator),
        });
        trail.start(this.container);

        this.collabTrails.set(key, trail);
      }

      if (collaborator.pointer && collaborator.pointer.tool === "laser") {
        const buttonDown = collaborator.button === "down";
        const buttonUp = collaborator.button === "up";
        const buttonCancel = collaborator.button === "cancel";
        const hasTrail = trail.hasCurrentTrail;

        // Initialize a new trail
        if (buttonDown && !hasTrail) {
          trail.startPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        // Add only original points
        const lastPointOriginal = !trail.hasLastPoint(
          collaborator.pointer.x,
          collaborator.pointer.y,
        );
        if (buttonDown && lastPointOriginal) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        // End the trail on button up
        if (buttonUp && hasTrail) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
          trail.endPath();
        }

        if (buttonCancel) {
          trail.cancelPath();
        }
      }
    }
  }
}

/**
 * Non-decaying, ephemeral annotation strokes. Like laser trails these live in
 * the SVG overlay only, but completed paths are retained until `clearTrails`.
 */
export class AnnotationTrails implements Trail {
  public localTrail: AnimatedTrail;
  private collabTrails = new Map<SocketId, AnimatedTrail>();
  private container?: SVGSVGElement;

  constructor(private app: App) {
    this.localTrail = this.createTrail(() => DEFAULT_LASER_COLOR);
  }

  private createTrail(fill: () => string) {
    return new AnimatedTrail(this.app, {
      simplify: 0,
      streamline: 0.4,
      sizeMapping: () => 1,
      persistent: true,
      fill,
    });
  }

  startPath(x: number, y: number): void {
    this.localTrail.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    this.localTrail.addPointToPath(x, y);
  }

  endPath(): void {
    this.localTrail.endPath();
  }

  cancelPath(): void {
    this.localTrail.cancelPath();
  }

  start(container: SVGSVGElement): void {
    this.container = container;
    this.localTrail.start(container);
  }

  stop(): void {
    this.localTrail.stop();
    this.stopCollabTrails();
    this.container = undefined;
  }

  clearLocalTrail(): void {
    this.localTrail.clearTrails();
  }

  clearTrails(): void {
    this.clearLocalTrail();
    for (const trail of this.collabTrails.values()) {
      trail.clearTrails();
    }
  }

  clearCollabTrail(socketId: SocketId): void {
    this.collabTrails.get(socketId)?.clearTrails();
  }

  redraw(): void {
    this.localTrail.redraw();
    for (const trail of this.collabTrails.values()) {
      trail.redraw();
    }
  }

  get hasLocalTrails(): boolean {
    return this.localTrail.hasTrails;
  }

  private stopCollabTrails(collaborators?: App["state"]["collaborators"]) {
    for (const [socketId, trail] of this.collabTrails) {
      if (!collaborators?.has(socketId)) {
        trail.stop();
        this.collabTrails.delete(socketId);
      }
    }
  }

  updateCollabTrails(collaborators: App["state"]["collaborators"]): void {
    this.stopCollabTrails(collaborators);

    if (!this.container) {
      return;
    }

    for (const [socketId, collaborator] of collaborators) {
      if (collaborator.isCurrentUser) {
        continue;
      }

      const currentTrail = this.collabTrails.get(socketId);
      if (!collaborator.pointer || collaborator.pointer.tool !== "annotation") {
        if (currentTrail?.hasCurrentTrail) {
          currentTrail.endPath();
        }
        continue;
      }

      let trail = currentTrail;
      if (!trail) {
        trail = this.createTrail(
          () =>
            collaborator.pointer?.laserColor ||
            getClientColor(socketId, collaborator),
        );
        trail.start(this.container);
        this.collabTrails.set(socketId, trail);
      }

      const { x, y } = collaborator.pointer;
      const buttonDown = collaborator.button === "down";
      const buttonUp = collaborator.button === "up";
      const buttonCancel = collaborator.button === "cancel";

      if (buttonDown && !trail.hasCurrentTrail) {
        trail.startPath(x, y);
      }
      if (buttonDown && !trail.hasLastPoint(x, y)) {
        trail.addPointToPath(x, y);
      }
      if (buttonUp && trail.hasCurrentTrail) {
        trail.addPointToPath(x, y);
        trail.endPath();
      }
      if (buttonCancel) {
        trail.cancelPath();
      }
    }
  }
}
