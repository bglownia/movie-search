const cache = new Map();
const apiKey = '3fccaeaf';
const formElement = document.getElementById('search-form');
const searchResultsElement = document.getElementById('search-results');
const movieTemplate = document.getElementById('movie-template');
const pageSize = 10;
const noImage =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjwvc3ZnPg==';
const errorMessage = 'Unexpected error occured. Please try again.';
const fetching = new Set();
let currentSearchParams;

function createElement(tagName, children) {
  const element = document.createElement(tagName);
  []
    .concat(children)
    .filter(child => child)
    .forEach(child => element.appendChild(child));
  return element;
}

const loadMoreButton = createElement('button', document.createTextNode('Load more'));

function createMovieElement(template, data) {
  const clone = template.content.cloneNode(true);
  if (data) {
    clone.querySelectorAll('[data-var]').forEach(element => {
      element.textContent = data[element.dataset.var];
    });
    clone.querySelector('a').href += data.imdbID;
    clone.querySelector('img').src = data.Poster.startsWith('http') ? data.Poster : noImage;
  }
  return clone;
}

function getTrimmedSearchParam(searchParams, key) {
  if (!searchParams.has(key)) {
    return null;
  }
  return searchParams.get(key).trim() || null;
}

function getApiSearchParams(search) {
  const searchParams = new URLSearchParams(search);
  const s = getTrimmedSearchParam(searchParams, 's');
  if (!s) {
    return null;
  }
  const y = getTrimmedSearchParam(searchParams, 'y');
  return new URLSearchParams(y ? { y, s } : { s });
}

function isSuccessfulResponse(data) {
  return data.Response === 'True';
}

function loadSearchResult(searchParams, more = false) {
  const cacheKey = searchParams.toString();
  if (fetching.has(cacheKey + more)) {
    return Promise.resolve(false);
  }
  const fullSearchParams = new URLSearchParams(searchParams);
  const cachedData = cache.get(cacheKey);
  if (more) {
    if (!cachedData || cachedData.Search.length === cachedData.totalResults) {
      return Promise.resolve(false);
    }
    fullSearchParams.set('page', cachedData.Search.length / pageSize + 1);
  } else if (cache.has(cacheKey)) {
    return Promise.resolve(cache.get(cacheKey));
  }
  fetching.add(cacheKey);
  fullSearchParams.set('apikey', apiKey);
  return fetch(`http://www.omdbapi.com/?${fullSearchParams}`)
    .then(response => response.json())
    .then(rawData => {
      const data = { ...rawData, totalResults: parseInt(rawData.totalResults, 10) };
      if (more) {
        if (isSuccessfulResponse(data)) {
          cachedData.Search.push(...data.Search);
        }
      } else {
        cache.set(cacheKey, data);
      }
      return data;
    })
    .finally(() => {
      fetching.delete(cacheKey + more);
    });
}

function createMoviesListElement(movies) {
  return createElement(
    'div',
    movies.map(movie => createMovieElement(movieTemplate, movie)),
  );
}

function displaySearchResult(data, searchParams) {
  if (currentSearchParams !== searchParams) {
    return;
  }
  searchResultsElement.innerHTML = '';
  if (!isSuccessfulResponse(data)) {
    searchResultsElement.appendChild(createElement('p', document.createTextNode(data.Error)));
    return;
  }
  searchResultsElement.appendChild(
    createElement(
      'p',
      document.createTextNode(
        `${data.totalResults} movie${data.totalResults > 1 ? 's' : ''} found`,
      ),
    ),
  );
  searchResultsElement.appendChild(createMoviesListElement(data.Search));
  if (data.totalResults > data.Search.length) {
    searchResultsElement.appendChild(loadMoreButton);
  }
}

const displaySearchResultError = displaySearchResult.bind(null, { Error: errorMessage });

function displayMoreSearchResult(data, searchParams) {
  if (currentSearchParams !== searchParams) {
    return;
  }
  let errorMessageElement = searchResultsElement.querySelector('p.error');
  if (!isSuccessfulResponse(data)) {
    if (!errorMessageElement) {
      errorMessageElement = createElement('p', document.createTextNode(data.Error));
      errorMessageElement.className = 'error';
      searchResultsElement.insertBefore(errorMessageElement, loadMoreButton);
    }
    return;
  }
  if (errorMessageElement) {
    errorMessageElement.remove();
  }
  searchResultsElement.insertBefore(createMoviesListElement(data.Search), loadMoreButton);
  const cachedData = cache.get(currentSearchParams);
  if (cachedData.Search.length === cachedData.totalResults) {
    loadMoreButton.remove();
  }
}

const displayMoreSearchResultError = displayMoreSearchResult.bind(null, { Error: errorMessage });

function loadMore() {
  const searchParams = getApiSearchParams(window.location.search);
  if (!searchParams) {
    return;
  }
  loadSearchResult(searchParams, true)
    .then(data => {
      if (!data) {
        return;
      }
      displayMoreSearchResult(data, searchParams.toString());
    })
    .catch(displayMoreSearchResultError.bind(null, searchParams.toString()));
}

function loadAndDisplaySearchResult(setFormValues) {
  const searchParams = getApiSearchParams(window.location.search);
  if (!searchParams) {
    return;
  }
  if (setFormValues) {
    formElement.reset();
    searchParams.forEach((value, key) => {
      formElement.querySelector(`[name='${key}']`).value = value || '';
    });
  }
  currentSearchParams = searchParams.toString();
  loadSearchResult(searchParams)
    .then(data => displaySearchResult(data, searchParams.toString()))
    .catch(displaySearchResultError.bind(null, searchParams.toString()));
}

formElement.addEventListener('submit', event => {
  event.preventDefault();
  const searchParams = new URLSearchParams(new FormData(event.target)).toString();
  window.history.pushState(null, '', `?${searchParams}`);
  loadAndDisplaySearchResult();
});
loadMoreButton.addEventListener('click', loadMore);
window.addEventListener('popstate', () => loadAndDisplaySearchResult(true));
loadAndDisplaySearchResult(true);
document.querySelector('input').focus();
