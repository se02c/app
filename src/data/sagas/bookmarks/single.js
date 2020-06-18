import { call, put, takeEvery, select, all } from 'redux-saga/effects'
import Api from '../../modules/api'
import ApiError from '../../modules/error'
import _ from 'lodash-es'

import {
	BOOKMARK_CREATE_REQ, BOOKMARK_CREATE_SUCCESS, BOOKMARK_CREATE_ERROR,
	BOOKMARK_UPDATE_REQ, BOOKMARK_UPDATE_SUCCESS, BOOKMARK_UPDATE_ERROR,
	BOOKMARK_REMOVE_REQ, BOOKMARK_REMOVE_SUCCESS, BOOKMARK_REMOVE_ERROR,
	BOOKMARK_UPLOAD_REQ, BOOKMARK_UPLOAD_PROGRESS,
	BOOKMARK_REORDER, BOOKMARK_COVER_UPLOAD_REQ,

	BOOKMARK_RECOVER, BOOKMARK_IMPORTANT, BOOKMARK_SCREENSHOT, BOOKMARK_REPARSE, BOOKMARK_MOVE, BOOKMARK_PRELOAD
} from '../../constants/bookmarks'

import {
	getBookmark,
	getBookmarkScreenshotIndex,
	getMeta
} from '../../helpers/bookmarks'

//Requests
export default function* () {
	//helpers
	yield takeEvery(BOOKMARK_RECOVER, recover)
	yield takeEvery(BOOKMARK_IMPORTANT, important)
	yield takeEvery(BOOKMARK_SCREENSHOT, screenshot)
	yield takeEvery(BOOKMARK_REPARSE, reparse)
	yield takeEvery(BOOKMARK_MOVE, move)
	yield takeEvery(BOOKMARK_PRELOAD, preload)
	yield takeEvery(BOOKMARK_REORDER, reorder)
	yield takeEvery(BOOKMARK_COVER_UPLOAD_REQ, uploadCover)

	//single
	yield takeEvery(BOOKMARK_CREATE_REQ, createBookmark)
	yield takeEvery(BOOKMARK_UPDATE_REQ, updateBookmark)
	yield takeEvery(BOOKMARK_REMOVE_REQ, removeBookmark)
	yield takeEvery(BOOKMARK_UPLOAD_REQ, uploadBookmark)
}

function* createBookmark({obj={}, ignore=false, onSuccess, onFail}) {
	if (ignore)
		return;

	try{
		const state = yield select()
		var collectionId = obj.collectionId || state.config.last_collection

		const [parsed, checkCollectionId] = yield all([
			call(Api.get, 'parse?url='+encodeURIComponent(obj.link)),
			call(Api.get, 'collection/'+collectionId)
		])

		parsed.item = parsed.item || {}

		//Collection not found, so reset it
		if (!checkCollectionId.result || collectionId<0)
			collectionId = 0

		const canonicalURL = obj.link //parsed.item.meta.canonical||

		const {item={}, result=false, error, errorMessage} = yield call(Api.post, 'raindrop', Object.assign({}, obj, {
			url: canonicalURL,
			link: canonicalURL,
			title: parsed.item.title,
			excerpt: parsed.item.excerpt,
			media: parsed.item.media,
			type: parsed.item.type,
			html: parsed.item.html,
			collectionId: parseInt(collectionId||-1),
			cover: 0,
			parser: parsed.item.parser
		}))

		if (!result)
			throw new ApiError(error, errorMessage||'cant save bookmark')

		item.new = true

		yield put({
			type: BOOKMARK_CREATE_SUCCESS,
			_id: item._id,
			item,
			onSuccess, onFail
		});
	} catch (error) {
		yield put({
			type: BOOKMARK_CREATE_ERROR,
			obj,
			error,
			onSuccess, onFail
		});
	}
}

function* uploadBookmark({obj={}, ignore=false, onSuccess, onFail}) {
	if (ignore)
		return;

	try{
		//Todo: Check collectionId before creating bookmark!

		const { item={}, result=false, error, errorMessage } = yield call(Api.upload, 'raindrop/file', obj)
		if (!result)
			throw new ApiError(error, errorMessage||'cant upload bookmark')

		yield put({
			type: BOOKMARK_CREATE_SUCCESS,
			_id: item._id,
			item: item,
			onSuccess, onFail
		});
	} catch (error) {
		yield put({
			type: BOOKMARK_CREATE_ERROR,
			obj,
			error,
			onSuccess, onFail
		});
	}
}

function* updateBookmark({_id, set={}, ignore=false, onSuccess, onFail}) {
	if ((ignore)||(!_id))
		return;

	try{
		const {item={}, result=false, error, errorMessage} = yield call(Api.put, 'raindrop/'+_id, set)

		if (!result)
			throw new ApiError(error, errorMessage||'cant update bookmark')

		yield put({
			type: BOOKMARK_UPDATE_SUCCESS,
			item: item,
			onSuccess, onFail
		});
	} catch (error) {
		yield put({
			type: BOOKMARK_UPDATE_ERROR,
			_id: _id,
			error,
			onSuccess, onFail
		});
	}
}

function* removeBookmark({_id, ignore=false, onSuccess, onFail}) {
	if ((ignore)||(!_id))
		return;

	try{
		const {result=false, error, errorMessage} = yield call(Api.del, 'raindrop/'+_id)
		if (!result)
			throw new ApiError(error, errorMessage||'cant remove bookmark')

		yield put({
			type: BOOKMARK_REMOVE_SUCCESS,
			_id,
			onSuccess, onFail
		});
	} catch (error) {
		yield put({
			type: BOOKMARK_REMOVE_ERROR,
			_id: _id,
			error,
			onSuccess, onFail
		});
	}
}

function* recover({_id, ignore=false, onSuccess, onFail}) {
	if ((ignore)||(!_id))
		return;

	try{
		const state = yield select()
		const item = getBookmark(state.bookmarks, _id)

		yield put({
			type: BOOKMARK_UPDATE_REQ,
			_id: item._id,
			set: {
				collectionId: -1,
				removed: false
			},
			onSuccess
		})
	}catch(error){
		yield put({
			type: BOOKMARK_UPDATE_ERROR,
			_id: _id,
			error,
			onFail
		})
	}
}

function* important({_id, ignore=false, onSuccess, onFail}) {
	if ((ignore)||(!_id))
		return;

	try{
		const state = yield select()
		const item = getBookmark(state.bookmarks, _id)

		yield put({
			type: BOOKMARK_UPDATE_REQ,
			_id: item._id,
			set: {
				important: item.important
			},
			onSuccess
		})
	}catch(error){
		yield put({
			type: BOOKMARK_UPDATE_ERROR,
			_id: _id,
			error,
			onFail
		})
	}
}

function* screenshot({_id, ignore=false, onSuccess, onFail}) {
	if ((ignore)||(!_id))
		return;

	try{
		const state = yield select()
		const item = getBookmark(state.bookmarks, _id)
		const meta = getMeta(state.bookmarks, _id)
		const screenshotIndex = getBookmarkScreenshotIndex(state.bookmarks, _id)

		var setReq = {}
		if (screenshotIndex!=-1){
			setReq = {
				coverId: screenshotIndex
			}
		}else{
			const newMedia = meta.media.concat([{link: '<screenshot>'}])
			setReq = {
				media: newMedia,
				coverId: newMedia.length-1
			}
		}

		yield put({
			type: BOOKMARK_UPDATE_REQ,
			_id: item._id,
			set: setReq,
			onSuccess
		})
	}catch(error){
		yield put({
			type: BOOKMARK_UPDATE_ERROR,
			_id: _id,
			error,
			onFail
		})
	}
}

function* reparse({_id, ignore=false, onSuccess, onFail}) {
	if ((ignore)||(!_id))
		return;

	try{
		const state = yield select()
		const item = getBookmark(state.bookmarks, _id)

		yield put({
			type: BOOKMARK_UPDATE_REQ,
			_id: item._id,
			set: {
				pleaseParse: {
					date: new Date()
				}
			},
			onSuccess
		})
	}catch(error){
		yield put({
			type: BOOKMARK_UPDATE_ERROR,
			_id: _id,
			error,
			onFail
		})
	}
}

function* move({_id, collectionId, ignore=false, onSuccess, onFail}) {
	if ((ignore)||(!_id))
		return;

	try{
		yield put({
			type: BOOKMARK_UPDATE_REQ,
			_id: _id,
			set: {
				collectionId: collectionId
			},
			onSuccess
		})
	}catch(error){
		yield put({
			type: BOOKMARK_UPDATE_ERROR,
			_id: _id,
			error,
			onFail
		})
	}
}

function* preload({link}) {
	try{
		yield call(Api.get, 'parse?url='+encodeURIComponent(link))
	} catch(error){}
}

function* reorder({ _id, ignore, order, collectionId }) {
	if (ignore || typeof order == 'undefined') return

	yield put({
		type: BOOKMARK_UPDATE_REQ,
		_id: _id,
		set: {
			order,
			collectionId
		}
	})
}

function* uploadCover({ _id=0, cover, ignore=false, onSuccess, onFail }) {
	if (ignore) return

	try{
		const { item={}, result=false, error, errorMessage } = yield call(Api.upload, `raindrop/${_id}/cover`, { cover })
		if (!result)
			throw new ApiError(error, errorMessage||'cant upload raindrop cover')

		yield put({
			type: BOOKMARK_UPDATE_REQ,
			_id,
			item: item,
			onSuccess, onFail
		});
	} catch (error) {
		yield put({
			type: BOOKMARK_UPDATE_ERROR,
			_id,
			error,
			onSuccess, onFail
		});
	}
}