// Source: https://github.com/GuptaSiddhant/react-broadcast-channel/blob/main/src/index.ts

import { useEffect, useCallback, useRef, useState } from "react"

/**
 * React hook to create and manage a Broadcast Channel across multiple browser windows.
 *
 * @param channelName Static name of channel used across the browser windows.
 * @param handleMessage Callback to handle the event generated when `message` is received.
 * @param handleMessageError [optional] Callback to handle the event generated when `error` is received.
 * @returns A function to send/post message on the channel.
 * @example
 * ```tsx
 * import {useBroadcastChannel} from 'react-broadcast-channel';
 *
 * function App () {
 *   const postUserIdMessage = useBroadcastChannel('userId', (e) => alert(e.data));
 *   return (<button onClick={() => postUserIdMessage('ABC123')}>Send UserId</button>);
 * }
 * ```
 * ---
 * Works in browser that support Broadcast Channel API natively. See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API#browser_compatibility).
 * To support other browsers, install and use [broadcastchannel-polyfill](https://www.npmjs.com/package/broadcastchannel-polyfill).
 */
export function useBroadcastChannel(
  channelName,
  handleMessage,
  handleMessageError
) {
  const channelRef = useRef(
    typeof window !== "undefined" && "BroadcastChannel" in window
      ? new BroadcastChannel(channelName + "-channel")
      : null
  )

  useChannelEventListener(channelRef, "message", handleMessage)
  useChannelEventListener(channelRef, "messageerror", handleMessageError)

  return useCallback(
    data => {
      channelRef?.current?.postMessage(data)
    },
    [channelRef]
  )
}

/**
 * React hook to manage state across browser windows. Has the similar signature as `React.useState`.
 *
 * @param channelName Static name of channel used across the browser windows.
 * @param initialState Initial state.
 * @returns Tuple of state and setter for the state.
 * @example
 * ```tsx
 * import {useBroadcastState} from 'react-broadcast-channel';
 *
 * function App () {
 *   const [count, setCount] = useBroadcastState('count', 0);
 *   return (
 *     <div>
 *       <button onClick={() => setCount(prev => prev - 1)}>Decrement</button>
 *       <span>{count}</span>
 *       <button onClick={() => setCount(prev => prev + 1)}>Increment</button>
 *     </div>
 *   );
 * }
 * ```
 * ---
 * Works in browser that support Broadcast Channel API natively. See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API#browser_compatibility).
 * To support other browsers, install and use [broadcastchannel-polyfill](https://www.npmjs.com/package/broadcastchannel-polyfill).
 */
export function useBroadcastState(channelName, initialState) {
  const [state, setState] = useState(initialState)
  const setter = useBroadcastChannel(channelName, ev => setState(ev.data))
  useEffect(() => setter(state), [setter, state])
  return [state, setState]
}

// Helpers

/** Hook to subscribe/unsubscribe from channel events. */
function useChannelEventListener(channelRef, event, handler = () => { }) {
  useEffect(() => {
    const channel = channelRef.current
    if (channel) {
      channel.addEventListener(event, handler)
      return () => channel.removeEventListener(event, handler)
    }
  }, [channelRef, event, handler])
}
