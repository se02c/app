import Immutable from 'seamless-immutable'
import _ from 'lodash-es'
import { createSelector } from 'reselect'
import { isPro } from './user'
const emptyTags = Immutable([])

export const getTags = ({tags})=>(tags && tags.items)||emptyTags

export const getSuggested = ({tags}, _id)=>tags.suggested[_id] ? tags.suggested[_id] : emptyTags

export const makeFilteredTags = ()=>createSelector(
	[getTags, (state, selected)=>selected],
	(tags, selected)=>{
		return tags.filter(({name})=>!selected.includes(name))
	}
)

export const makeSuggestedTags = ()=>createSelector(
	[
		isPro,
		getSuggested,
		//get current tags of draft
		({bookmarks={}}, _id)=>{
			return bookmarks.getIn(['drafts', 'byId', _id, 'item', 'tags'])||emptyTags
		}
	],
	(pro, suggested, current)=>pro ? _.filter(suggested, (item)=>current.indexOf(item.name)==-1) : emptyTags
)