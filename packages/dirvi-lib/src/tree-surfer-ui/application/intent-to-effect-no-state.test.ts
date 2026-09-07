// import { describe, expect, it } from 'vitest';
//
// import type { PosixState } from '../../domain/posix-node.js';
// import { intentToEffect } from './intent-to-effect.js';
//
// const state = {} as PosixState;
//
// describe('intentToEffectNoState', () => {
//   describe('normal mode buffer', () => {
//     it('stores z as a possible command prefix', () => {
//       expect(
//         intentToEffect(
//           {
//             intentType: 'setNormalBuffer',
//             normalBuffer: 'z',
//           },
//           state,
//         ),
//       ).toEqual({
//         effectType: 'setInputState',
//         inputState: {
//           inputMode: 'normal',
//           normalBuffer: 'z',
//         },
//       });
//     });
//
//     it.each([
//       ['za', 'toggleFold'],
//       ['zc', 'fold'],
//       ['zo', 'unfold'],
//     ] as const)(
//       'converts %s into a %s effect action',
//       (normalBuffer, effectActionType) => {
//         expect(
//           intentToEffect(
//             {
//               intentType: 'setNormalBuffer',
//               normalBuffer,
//             },
//             state,
//           ),
//         ).toEqual({
//           effectType: 'dispatchEffectAction',
//           action: {
//             effectActionType,
//           },
//         });
//       },
//     );
//
//     it('clears the normal buffer when the input is not a known command', () => {
//       expect(
//         intentToEffect(
//           {
//             intentType: 'setNormalBuffer',
//             normalBuffer: 'x',
//           },
//           state,
//         ),
//       ).toEqual({
//         effectType: 'setInputState',
//         inputState: {
//           inputMode: 'normal',
//           normalBuffer: '',
//         },
//       });
//     });
//   });
//
//   describe('normal mode navigation', () => {
//     it('moves to the next entry', () => {
//       expect(
//         intentToEffect(
//           {
//             intentType: 'normalDown',
//           },
//           state,
//         ),
//       ).toEqual({
//         effectType: 'dispatchEffectAction',
//         action: {
//           effectActionType: 'nextEntry',
//         },
//       });
//     });
//
//     it('moves to the previous entry', () => {
//       expect(
//         intentToEffect(
//           {
//             intentType: 'normalUp',
//           },
//           state,
//         ),
//       ).toEqual({
//         effectType: 'dispatchEffectAction',
//         action: {
//           effectActionType: 'prevEntry',
//         },
//       });
//     });
//   });
//
//   describe('command-line mode', () => {
//     it('enters command-line mode', () => {
//       expect(
//         intentToEffect(
//           {
//             intentType: 'enterCommandLineMode',
//           },
//           state,
//         ),
//       ).toEqual({
//         effectType: 'setInputState',
//         inputState: {
//           inputMode: 'command',
//           commandLine: ':',
//         },
//       });
//     });
//
//     it('updates the command line', () => {
//       expect(
//         intentToEffect(
//           {
//             intentType: 'setCommandLine',
//             commandLine: ':w',
//           },
//           state,
//         ),
//       ).toEqual({
//         effectType: 'setInputState',
//         inputState: {
//           inputMode: 'command',
//           commandLine: ':w',
//         },
//       });
//     });
//
//     it('exits command-line mode', () => {
//       expect(
//         intentToEffect(
//           {
//             intentType: 'exitCommandLineMode',
//           },
//           state,
//         ),
//       ).toEqual({
//         effectType: 'setInputState',
//         inputState: {
//           inputMode: 'normal',
//           normalBuffer: '',
//         },
//       });
//     });
//
//     it('returns to normal mode after executing a gibberish command line', () => {
//       expect(
//         intentToEffect(
//           {
//             intentType: 'executeCommandLine',
//             commandLine: ':sijbas',
//           },
//           state,
//         ),
//       ).toEqual({
//         effectType: 'setInputState',
//         inputState: {
//           inputMode: 'normal',
//           normalBuffer: '',
//         },
//       });
//     });
//
//     it('quits when the :q command is executed', () => {
//       expect(
//         intentToEffect(
//           {
//             intentType: 'executeCommandLine',
//             commandLine: ':q',
//           },
//           state,
//         ),
//       ).toEqual({
//         effectType: 'quit',
//         exitMessage: '',
//       });
//     });
//   });
// });
