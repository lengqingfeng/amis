// 多语言支持
import React from 'react';
import hoistNonReactStatic from 'hoist-non-react-statics';
import {resolveVariable} from './utils/tpl-builtin';

export type TranslateFn<T = any> = (str: T, data?: object) => T;

interface LocaleConfig {
  [propsName: string]: string;
}

let defaultLocale: string = 'zh-CN';

const locales: {
  [propName: string]: LocaleConfig;
} = {};

export function register(name: string, config: LocaleConfig) {
  // 修改为扩展，防止已注册的语料被覆盖
  extendLocale(name, config);
}

export function extendLocale(name: string, config: LocaleConfig) {
  locales[name] = {
    ...(locales[name] || {}),
    ...config
  };
}

/** 删除语料数据 */
export function removeLocaleData(name: string, key: Array<string> | string) {
  if (Array.isArray(key)) {
    key.forEach(item => {
      removeLocaleData(name, item);
    });
    return;
  }
  if (locales?.[name]?.[key]) {
    delete locales[name][key];
  }
}

const fns: {
  [propName: string]: TranslateFn;
} = {};

function format(str: string, data?: object) {
  return str.replace(/(\\)?\{\{([\s\S]+?)\}\}/g, (_, escape, key) => {
    if (escape) {
      return _.substring(1);
    }

    return resolveVariable(key, data || {});
  });
}

export function makeTranslator(locale?: string): TranslateFn {
  if (locale && fns[locale]) {
    return fns[locale];
  }

  const fn = (str: any, ...args: any[]) => {
    if (!str || typeof str !== 'string') {
      return str;
    }

    const value =
      locales[locale!]?.[str] ||
      locales[defaultLocale]?.[str] ||
      locales['zh-CN']?.[str] ||
      str;
    return format(value, ...args);
  };

  locale && (fns[locale] = fn);
  return fn;
}

export function getDefaultLocale() {
  return defaultLocale;
}

export function setDefaultLocale(loacle: string) {
  defaultLocale = loacle;
}

export interface LocaleProps {
  locale: string;
  translate: TranslateFn;
}

export const LocaleContext = React.createContext('');

export function localeable<
  T extends React.ComponentType<React.ComponentProps<T> & LocaleProps>
>(ComposedComponent: T) {
  type OuterProps = JSX.LibraryManagedAttributes<
    T,
    Omit<React.ComponentProps<T>, keyof LocaleProps>
  > & {
    locale?: string;
    translate?: (str: string, ...args: any[]) => string;
  };

  const result = hoistNonReactStatic(
    class extends React.Component<OuterProps> {
      static displayName = `I18N(${
        ComposedComponent.displayName || ComposedComponent.name
      })`;
      static contextType = LocaleContext;
      static ComposedComponent = ComposedComponent as React.ComponentType<T>;

      constructor(props: OuterProps) {
        super(props);

        this.childRef = this.childRef.bind(this);
        this.getWrappedInstance = this.getWrappedInstance.bind(this);
      }

      ref: any;

      childRef(ref: any) {
        while (ref && ref.getWrappedInstance) {
          ref = ref.getWrappedInstance();
        }

        this.ref = ref;
      }

      getWrappedInstance() {
        return this.ref;
      }

      render() {
        const locale: string =
          this.props.locale || (this.context as string) || defaultLocale;
        const translate = this.props.translate || makeTranslator(locale);
        const injectedProps: {
          locale: string;
          translate: TranslateFn;
        } = {
          locale,
          translate: translate!
        };
        const refConfig = ComposedComponent.prototype?.isReactComponent
          ? {ref: this.childRef}
          : {forwardedRef: this.childRef};

        const body = (
          <ComposedComponent
            {...(this.props as JSX.LibraryManagedAttributes<
              T,
              React.ComponentProps<T>
            > as any)}
            {...injectedProps}
            {...refConfig}
          />
        );
        return this.context ? (
          body
        ) : (
          <LocaleContext.Provider value={locale}>{body}</LocaleContext.Provider>
        );
      }
    },
    ComposedComponent
  );

  return result as typeof result & {
    ComposedComponent: T;
  };
}
