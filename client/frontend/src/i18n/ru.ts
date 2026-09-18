export interface Translations {
  app: {
    title: string;
  };
  sidebar: {
    projects: string;
    environments: string;
    newProject: string;
    noProjects: string;
    sync: string;
  };
  profile: {
    signIn: string;
    signInTitle: string;
    signInLogin: string;
    signInInvite: string;
    serverUrl: string;
    email: string;
    password: string;
    inviteUrl: string;
    setPassword: string;
    invitePasswordHint: string;
    inviteWelcome: string;
    submit: string;
    activateAccount: string;
    cancel: string;
    signingIn: string;
    signInError: string;
    settings: string;
    signOut: string;
    local: string;
  };
  tabs: {
    newRequest: string;
    settings: string;
  };
  empty: {
    createRequest: string;
    quote: string;
    quoteAuthor: string;
  };
  request: {
    send: string;
    save: string;
    saved: string;
    method: string;
    url: string;
    headers: string;
    body: string;
    response: string;
    noResponse: string;
    params: string;
    authorization: string;
    paramKey: string;
    paramValue: string;
    headerKey: string;
    headerValue: string;
    addParam: string;
    addHeader: string;
    authType: string;
    authNone: string;
    responseBody: string;
    responseHeaders: string;
    cookies: string;
    pretty: string;
    copy: string;
    copied: string;
    search: string;
    searchPlaceholder: string;
    noResults: string;
    bodyModeNone: string;
    bodyModeFormData: string;
    bodyModeUrlencoded: string;
    bodyModeRaw: string;
    bodyModeBinary: string;
    bodyModeGraphql: string;
    bodyNoneHint: string;
    bodyBeautify: string;
    bodyJsonPlaceholder: string;
    bodyXmlPlaceholder: string;
    bodySelectFile: string;
    bodyNoFile: string;
    graphqlQuery: string;
    graphqlVariables: string;
  };
  settings: {
    title: string;
    language: string;
    languageRu: string;
    languageEn: string;
    myProfileName: string;
    appearance: string;
  };
  environment: {
    noEnvironment: string;
    select: string;
    variable: string;
    value: string;
    save: string;
    saved: string;
    addVariable: string;
  };
  contextMenu: {
    rename: string;
    copy: string;
    duplicate: string;
    delete: string;
    addRequest: string;
    addFolder: string;
  };
  cookies: {
    title: string;
    manageCookies: string;
    syncCookies: string;
    syncComingSoon: string;
    domainPlaceholder: string;
    addDomain: string;
    countOne: string;
    countMany: string;
    addCookie: string;
    clearAll: string;
    domainAllowlist: string;
    allowlistHint: string;
    allowlistPlaceholder: string;
    saveAllowlist: string;
    cookieName: string;
    cookieValue: string;
    cookieDomain: string;
    cookiePath: string;
    cookieEnabled: string;
    saveCookie: string;
    deleteCookie: string;
    cancel: string;
    newCookie: string;
  };
}

export const ru: Translations = {
  app: {
    title: 'egogo',
  },
  sidebar: {
    projects: 'Проекты',
    environments: 'Окружения',
    newProject: 'Новый проект',
    noProjects: 'Пока нет проектов',
    sync: 'Синхронизировать',
  },
  profile: {
    signIn: 'Войти в профиль',
    signInTitle: 'Вход в профиль',
    signInLogin: 'Логин',
    signInInvite: 'Invite-ссылка',
    serverUrl: 'URL сервера',
    email: 'Email',
    password: 'Пароль',
    inviteUrl: 'Invite-ссылка',
    setPassword: 'Задайте пароль',
    invitePasswordHint: 'Минимум 8 символов',
    inviteWelcome: 'Приглашение для {email}',
    submit: 'Войти',
    activateAccount: 'Активировать',
    cancel: 'Отмена',
    signingIn: 'Вход…',
    signInError: 'Не удалось войти',
    settings: 'Настройки профиля',
    signOut: 'Выйти',
    local: 'Локальный',
  },
  tabs: {
    newRequest: 'Новый запрос',
    settings: 'Настройки',
  },
  empty: {
    createRequest: 'Создать запрос',
    quote: 'Путь в тысячу ли начинается с первого шага.',
    quoteAuthor: 'Лао-цзы',
  },
  request: {
    send: 'Отправить',
    save: 'Сохранить',
    saved: 'Сохранено',
    method: 'Метод',
    url: 'URL',
    headers: 'Headers',
    body: 'Body',
    response: 'Ответ',
    noResponse: 'Нажмите «Отправить» для выполнения запроса',
    params: 'Params',
    authorization: 'Authorization',
    paramKey: 'Ключ',
    paramValue: 'Значение',
    headerKey: 'Заголовок',
    headerValue: 'Значение',
    addParam: 'Добавить параметр',
    addHeader: 'Добавить заголовок',
    authType: 'Тип авторизации',
    authNone: 'Нет',
    responseBody: 'Body',
    responseHeaders: 'Headers',
    cookies: 'Cookies',
    pretty: 'Pretty',
    copy: 'Копировать',
    copied: 'Скопировано',
    search: 'Поиск',
    searchPlaceholder: 'Найти в теле ответа…',
    noResults: 'Нет совпадений',
    bodyModeNone: 'none',
    bodyModeFormData: 'form-data',
    bodyModeUrlencoded: 'x-www-form-urlencoded',
    bodyModeRaw: 'raw',
    bodyModeBinary: 'binary',
    bodyModeGraphql: 'GraphQL',
    bodyNoneHint: 'This request does not have a body',
    bodyBeautify: 'Beautify',
    bodyJsonPlaceholder: 'Enter JSON body…',
    bodyXmlPlaceholder: 'Enter XML body…',
    bodySelectFile: 'Select file',
    bodyNoFile: 'No file selected',
    graphqlQuery: 'Query',
    graphqlVariables: 'GraphQL Variables',
  },
  settings: {
    title: 'Настройки',
    language: 'Язык',
    languageRu: 'Русский',
    languageEn: 'English',
    myProfileName: 'Имя локального профиля',
    appearance: 'Внешний вид',
  },
  environment: {
    noEnvironment: 'Без окружения',
    select: 'Выберите окружение',
    variable: 'Переменная',
    value: 'Значение',
    save: 'Сохранить',
    saved: 'Сохранено',
    addVariable: 'Добавить переменную',
  },
  contextMenu: {
    rename: 'Переименовать',
    copy: 'Копировать',
    duplicate: 'Дублировать',
    delete: 'Удалить',
    addRequest: 'Добавить запрос',
    addFolder: 'Добавить папку',
  },
  cookies: {
    title: 'Cookies',
    manageCookies: 'Manage Cookies',
    syncCookies: 'Sync Cookies',
    syncComingSoon: 'Синхронизация cookies скоро будет доступна.',
    domainPlaceholder: 'Type a domain name',
    addDomain: 'Add domain',
    countOne: '1 cookie',
    countMany: '{n} cookies',
    addCookie: 'Add cookie',
    clearAll: 'Clear all cookies',
    domainAllowlist: 'Domains allowlist',
    allowlistHint:
      'Если список не пуст, cookies будут сохраняться и отправляться только для указанных доменов. По одному домену на строку.',
    allowlistPlaceholder: 'example.com\napi.example.com',
    saveAllowlist: 'Save',
    cookieName: 'Name',
    cookieValue: 'Value',
    cookieDomain: 'Domain',
    cookiePath: 'Path',
    cookieEnabled: 'Enabled',
    saveCookie: 'Save',
    deleteCookie: 'Delete',
    cancel: 'Cancel',
    newCookie: 'New cookie',
  },
};
